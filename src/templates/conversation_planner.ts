/**
 * Valyrian Edge - Conversation Planner
 * Multi-turn state machine for complex attack scenarios
 */

import type {
    AttackTemplate,
    ConversationStep,
    TemplateMatcher,
    TemplateResult,
} from './template.types.js';
import { TemplateEngine } from './template_engine.js';

// =============================================================================
// TYPES
// =============================================================================

export type ConversationState =
    | 'idle'
    | 'building_rapport'
    | 'probing'
    | 'escalating'
    | 'exploiting'
    | 'completed'
    | 'failed';

export interface ConversationContext {
    /** Current state in the state machine */
    state: ConversationState;
    /** All messages exchanged */
    history: ConversationMessage[];
    /** Variables gathered during conversation */
    variables: Record<string, string>;
    /** Steps completed so far */
    completedSteps: number;
    /** Total steps planned */
    totalSteps: number;
    /** Intermediate matcher results */
    matchResults: Array<{ step: number; matched: boolean; matchedBy: string[] }>;
    /** Whether to break out of the conversation */
    shouldBreak: boolean;
}

export interface ConversationMessage {
    role: 'attacker' | 'target';
    content: string;
    timestamp: Date;
    step: number;
    metadata?: Record<string, unknown>;
}

export interface PlannerOptions {
    /** Max retries per step */
    maxRetries?: number;
    /** Delay between messages (ms) */
    messageDelay?: number;
    /** Timeout per step (ms) */
    stepTimeout?: number;
    /** Custom variable injections */
    variables?: Record<string, string>;
    /** Callback on each step */
    onStep?: (ctx: ConversationContext, step: ConversationStep) => void;
}

// =============================================================================
// TRANSITION TABLE
// =============================================================================

const STATE_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
    idle: ['building_rapport', 'probing'],
    building_rapport: ['probing', 'escalating', 'failed'],
    probing: ['escalating', 'exploiting', 'completed', 'failed'],
    escalating: ['exploiting', 'completed', 'failed'],
    exploiting: ['completed', 'failed'],
    completed: [],
    failed: [],
};

// =============================================================================
// CONVERSATION PLANNER
// =============================================================================

export class ConversationPlanner {
    private engine: TemplateEngine;

    constructor(engine?: TemplateEngine) {
        this.engine = engine ?? new TemplateEngine();
    }

    /**
     * Execute a multi-turn conversation attack from a template
     */
    async execute(
        template: AttackTemplate,
        sendFn: (message: string) => Promise<string>,
        options: PlannerOptions = {},
    ): Promise<TemplateResult> {
        const steps = template.conversation ?? [];
        const mergedVars = { ...template.variables, ...options.variables };

        const ctx: ConversationContext = {
            state: 'idle',
            history: [],
            variables: { ...mergedVars },
            completedSteps: 0,
            totalSteps: steps.length,
            matchResults: [],
            shouldBreak: false,
        };

        // Transition to initial state based on first step role
        if (steps.length > 0) {
            const firstRole = steps[0]?.role;
            ctx.state = firstRole === 'setup' ? 'building_rapport' : 'probing';
        }

        const maxRetries = options.maxRetries ?? 1;
        const messageDelay = options.messageDelay ?? 200;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (!step || ctx.shouldBreak) break;

            // Interpolate variables into message
            const message = this.interpolateMessage(step.message, ctx.variables);

            // Execute with retry
            let response = '';
            let success = false;
            for (let retry = 0; retry < maxRetries; retry++) {
                try {
                    response = await sendFn(message);
                    success = true;
                    break;
                } catch (error) {
                    if (retry === maxRetries - 1) {
                        ctx.state = 'failed';
                        return this.buildResult(template, ctx, `Step ${i + 1} failed: ${error}`);
                    }
                }
            }

            if (!success) {
                ctx.state = 'failed';
                return this.buildResult(template, ctx, `Step ${i + 1} exhausted retries`);
            }

            // Record messages
            ctx.history.push({
                role: 'attacker',
                content: message,
                timestamp: new Date(),
                step: i + 1,
            });
            ctx.history.push({
                role: 'target',
                content: response,
                timestamp: new Date(),
                step: i + 1,
            });

            // Extract variables from response
            this.extractVariables(response, ctx);

            // Run step-level matchers
            if (step.matchers && step.matchers.length > 0) {
                const matchResult = this.engine.matchResponse(
                    response,
                    step.matchers as TemplateMatcher[],
                );
                ctx.matchResults.push({
                    step: i + 1,
                    matched: matchResult.matched,
                    matchedBy: matchResult.matchedBy,
                });

                if (matchResult.matched && step.breakOnMatch) {
                    ctx.shouldBreak = true;
                }
            }

            ctx.completedSteps = i + 1;
            options.onStep?.(ctx, step);

            // Transition state based on progress
            this.transitionState(ctx, step, i, steps.length);

            // Delay between messages
            if (i < steps.length - 1 && messageDelay > 0) {
                await new Promise(r => setTimeout(r, messageDelay));
            }
        }

        // Final state
        ctx.state = 'completed';

        // Run template-level matchers against last response
        const lastResponse = ctx.history
            .filter(m => m.role === 'target')
            .pop()?.content ?? '';

        const finalMatch = this.engine.matchResponse(
            lastResponse,
            template.matchers,
            template.matcherCondition,
        );

        return {
            templateId: template.id,
            templateName: template.name,
            success: finalMatch.matched || ctx.matchResults.some(r => r.matched),
            confidence: finalMatch.confidence,
            severity: template.severity,
            category: template.category,
            payload: ctx.history.filter(m => m.role === 'attacker').map(m => m.content).join(' → '),
            response: lastResponse.substring(0, 500),
            matchedBy: finalMatch.matchedBy,
            evidence: {
                conversationLog: ctx.history,
                stepMatchResults: ctx.matchResults,
                extractedVariables: ctx.variables,
                finalState: ctx.state,
            },
            timestamp: new Date(),
        };
    }

    /**
     * Build a multi-step conversation plan from template + context
     */
    buildPlan(template: AttackTemplate): ConversationStep[] {
        const steps = template.conversation ?? [];
        if (steps.length === 0 && template.payloads.length > 0) {
            // Convert single payloads into a conversation plan
            return template.payloads.map((p, i) => ({
                step: i + 1,
                role: 'probe' as const,
                message: p.content,
                waitForResponse: true,
                matchers: template.matchers as TemplateMatcher[] | undefined,
                breakOnMatch: false,
            }));
        }
        return steps;
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private interpolateMessage(message: string, variables: Record<string, string>): string {
        return message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] ?? match;
        });
    }

    private extractVariables(response: string, ctx: ConversationContext): void {
        // Extract system prompt if leaked
        const systemPromptMatch = response.match(/(?:system prompt|instructions?):\s*["']?(.+?)["']?(?:\.|$)/i);
        if (systemPromptMatch?.[1]) {
            ctx.variables['leaked_system_prompt'] = systemPromptMatch[1];
        }

        // Extract model name if revealed
        const modelMatch = response.match(/(?:I am|I'm|model is|running)\s+(GPT-[\w.]+|Claude[\w.-]*|Llama[\w.-]*|Gemini[\w.-]*)/i);
        if (modelMatch?.[1]) {
            ctx.variables['detected_model'] = modelMatch[1];
        }

        // Store last response for template interpolation
        ctx.variables['last_response'] = response.substring(0, 200);
    }

    private transitionState(
        ctx: ConversationContext,
        step: ConversationStep,
        index: number,
        total: number,
    ): void {
        const progress = (index + 1) / total;
        const allowed = STATE_TRANSITIONS[ctx.state] ?? [];

        if (step.role === 'setup' && allowed.includes('building_rapport')) {
            ctx.state = 'building_rapport';
        } else if (step.role === 'probe' && progress < 0.5 && allowed.includes('probing')) {
            ctx.state = 'probing';
        } else if (step.role === 'probe' && progress >= 0.5 && allowed.includes('escalating')) {
            ctx.state = 'escalating';
        } else if (step.role === 'extract' && allowed.includes('exploiting')) {
            ctx.state = 'exploiting';
        }

        // Auto-escalate if a step matched
        const lastMatch = ctx.matchResults[ctx.matchResults.length - 1];
        if (lastMatch?.matched && allowed.includes('escalating')) {
            ctx.state = 'escalating';
        }
    }

    private buildResult(
        template: AttackTemplate,
        ctx: ConversationContext,
        error: string,
    ): TemplateResult {
        const lastResponse = ctx.history
            .filter(m => m.role === 'target')
            .pop()?.content ?? error;

        return {
            templateId: template.id,
            templateName: template.name,
            success: false,
            confidence: 0,
            severity: template.severity,
            category: template.category,
            payload: ctx.history.filter(m => m.role === 'attacker').map(m => m.content).join(' → '),
            response: lastResponse.substring(0, 500),
            matchedBy: [],
            evidence: {
                error,
                conversationLog: ctx.history,
                finalState: ctx.state,
            },
            timestamp: new Date(),
        };
    }
}

export default ConversationPlanner;
