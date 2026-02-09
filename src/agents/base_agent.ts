/**
 * Valyrian Edge - Base Agent
 * Abstract base class for all security testing agents
 */


import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
    IAgent,
    AgentState,
    AgentContext,
    ConversationTurn,

    ToolDefinition,
    ToolCall,
    ToolResult,
} from '../types/index.js';
import { createLLMClient, chat, type ChatMessage } from './llm_client.js';
import { createLogger } from '../utils/logger.js';
import type { Logger } from 'pino';

// =============================================================================
// BASE AGENT ABSTRACT CLASS
// =============================================================================

export abstract class BaseAgent<TInput, TOutput> implements IAgent<TInput, TOutput> {
    abstract readonly name: string;
    abstract readonly description: string;

    protected logger: Logger;
    protected llmClient: BaseChatModel | null = null;
    protected context: AgentContext | null = null;
    protected conversationHistory: ConversationTurn[] = [];
    protected systemPrompt: string = '';
    protected aborted: boolean = false;

    state: AgentState = {
        status: 'idle',
        progress: 0,
        apiCallCount: 0,
        tokenUsage: { input: 0, output: 0, total: 0 },
    };

    constructor() {
        this.logger = createLogger('agent');
    }

    // ===========================================================================
    // LIFECYCLE METHODS
    // ===========================================================================

    async initialize(context: AgentContext): Promise<void> {
        this.context = context;
        this.logger = createLogger('agent', {
            agentName: this.name,
            sessionId: context.sessionId
        });

        this.state = {
            status: 'initializing',
            progress: 0,
            apiCallCount: 0,
            tokenUsage: { input: 0, output: 0, total: 0 },
            startedAt: new Date(),
        };

        // Create LLM client
        this.llmClient = createLLMClient({ config: context.llm });

        // Load system prompt
        this.systemPrompt = await this.loadSystemPrompt();

        // Initialize conversation history from context
        this.conversationHistory = [...context.conversationHistory];

        this.logger.info('Agent initialized');
        this.state.status = 'idle';
    }

    abstract execute(input: TInput): Promise<TOutput>;

    getStatus(): AgentState {
        return { ...this.state };
    }

    async abort(): Promise<void> {
        this.aborted = true;
        this.state.status = 'aborted';
        this.logger.warn('Agent aborted');
    }

    async cleanup(): Promise<void> {
        this.llmClient = null;
        this.context = null;
        this.conversationHistory = [];
        this.state.status = 'idle';
        this.state.completedAt = new Date();
        this.logger.info('Agent cleaned up');
    }

    // ===========================================================================
    // PROTECTED HELPER METHODS
    // ===========================================================================

    /**
     * Load the system prompt for this agent
     */
    protected async loadSystemPrompt(): Promise<string> {
        // Override in subclasses to load agent-specific prompts
        return `You are ${this.name}, a security testing agent. ${this.description}`;
    }

    /**
     * Send a message to the LLM and get a response
     */
    protected async sendMessage(userMessage: string): Promise<string> {
        if (!this.llmClient) {
            throw new Error('Agent not initialized. Call initialize() first.');
        }

        if (this.aborted) {
            throw new Error('Agent has been aborted');
        }

        // Build message history
        const messages: ChatMessage[] = this.conversationHistory.flatMap(turn => [
            { role: 'user' as const, content: turn.userMessage.content },
            { role: 'assistant' as const, content: turn.assistantMessage.content },
        ]);

        // Add current message
        messages.push({ role: 'user', content: userMessage });

        this.state.apiCallCount++;

        try {
            const response = await chat(this.llmClient, {
                messages,
                systemPrompt: this.systemPrompt,
            });

            // Update token usage
            if (response.tokenUsage) {
                this.state.tokenUsage.input += response.tokenUsage.input;
                this.state.tokenUsage.output += response.tokenUsage.output;
                this.state.tokenUsage.total += response.tokenUsage.total;
            }

            // Record conversation turn
            const turn: ConversationTurn = {
                turn: this.conversationHistory.length + 1,
                userMessage: {
                    role: 'user',
                    content: userMessage,
                    timestamp: new Date(),
                },
                assistantMessage: {
                    role: 'assistant',
                    content: response.content,
                    timestamp: new Date(),
                },
            };
            this.conversationHistory.push(turn);

            return response.content;
        } catch (error) {
            this.logger.error({ error }, 'LLM call failed');
            throw error;
        }
    }

    /**
     * Update agent progress
     */
    protected updateProgress(progress: number, operation?: string): void {
        this.state.progress = Math.min(100, Math.max(0, progress));
        if (operation) {
            this.state.currentOperation = operation;
        }
        this.logger.debug({ progress, operation }, 'Progress updated');
    }

    /**
     * Set agent status
     */
    protected setStatus(status: AgentState['status'], error?: string): void {
        this.state.status = status;
        if (error) {
            this.state.error = error;
        }
        if (status === 'completed' || status === 'failed') {
            this.state.completedAt = new Date();
        }
    }

    /**
     * Parse JSON from LLM response (handles markdown code blocks)
     */
    protected parseJsonResponse<T>(response: string): T {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonString = jsonMatch ? jsonMatch[1]?.trim() : response.trim();

        if (!jsonString) {
            throw new Error('No JSON content found in response');
        }

        try {
            return JSON.parse(jsonString) as T;
        } catch (error) {
            this.logger.error({ response: response.slice(0, 500) }, 'Failed to parse JSON response');
            throw new Error(`Failed to parse JSON response: ${error}`);
        }
    }

    /**
     * Rate limit helper - wait between requests
     */
    protected async rateLimit(): Promise<void> {
        const delay = 1000; // Default rate limit delay
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Check if agent should continue (not aborted)
     */
    protected shouldContinue(): boolean {
        return !this.aborted && this.state.status !== 'failed';
    }

    // ===========================================================================
    // TOOL HANDLING (for subclasses that use tools)
    // ===========================================================================

    /**
     * Get available tools for this agent
     * Override in subclasses that use tools
     */
    protected getTools(): ToolDefinition[] {
        return [];
    }

    /**
     * Execute a tool call
     * Override in subclasses that use tools
     */
    protected async executeTool(toolCall: ToolCall): Promise<ToolResult> {
        return {
            callId: toolCall.callId,
            success: false,
            error: `Tool ${toolCall.name} not implemented`,
        };
    }
}

export default BaseAgent;
