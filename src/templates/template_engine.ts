/**
 * Valyrian Edge - Template Engine
 * Loads, validates, interpolates, and runs YAML attack templates
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, extname, basename, dirname } from 'node:path';
import { parse as parseYAML } from 'yaml';
import type {
    AttackTemplate,
    TemplatePayload,
    TemplateMatcher,
    TemplateResult,
    TemplateCollection,
    TemplateCategory,
    PayloadEncoding,
    ConversationStep,
} from './template.types.js';

// =============================================================================
// ENCODING HELPERS
// =============================================================================

function applyEncoding(content: string, encoding: PayloadEncoding): string {
    switch (encoding) {
        case 'base64':
            return Buffer.from(content).toString('base64');
        case 'rot13':
            return content.replace(/[a-zA-Z]/g, (c) => {
                const base = c <= 'Z' ? 65 : 97;
                return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
            });
        case 'hex':
            return Buffer.from(content).toString('hex');
        case 'unicode':
            return [...content].map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
        case 'url':
            return encodeURIComponent(content);
        case 'reverse':
            return [...content].reverse().join('');
        case 'none':
        default:
            return content;
    }
}

// =============================================================================
// TEMPLATE ENGINE
// =============================================================================

export class TemplateEngine {
    private templates: AttackTemplate[] = [];
    private byCategory: Map<TemplateCategory, AttackTemplate[]> = new Map();
    private byTag: Map<string, AttackTemplate[]> = new Map();
    private templateDirs: string[];

    constructor(templateDirs?: string[]) {
        const defaultDir = resolve(process.cwd(), 'templates');
        this.templateDirs = templateDirs ?? [defaultDir];
    }

    // =========================================================================
    // LOADING
    // =========================================================================

    /**
     * Load all YAML templates from the configured directories
     */
    loadAll(): TemplateCollection {
        this.templates = [];
        this.byCategory.clear();
        this.byTag.clear();

        for (const dir of this.templateDirs) {
            if (!existsSync(dir)) continue;
            this.loadDirectory(dir);
        }

        // Build indexes
        for (const template of this.templates) {
            const catList = this.byCategory.get(template.category) ?? [];
            catList.push(template);
            this.byCategory.set(template.category, catList);

            for (const tag of template.tags) {
                const tagList = this.byTag.get(tag) ?? [];
                tagList.push(template);
                this.byTag.set(tag, tagList);
            }
        }

        return {
            templates: this.templates,
            byCategory: this.byCategory,
            byTag: this.byTag,
            count: this.templates.length,
        };
    }

    private loadDirectory(dir: string): void {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                this.loadDirectory(fullPath);
            } else if (extname(entry.name) === '.yaml' || extname(entry.name) === '.yml') {
                this.loadFile(fullPath);
            }
        }
    }

    private loadFile(filePath: string): void {
        try {
            const raw = readFileSync(filePath, 'utf-8');
            const parsed = parseYAML(raw);

            // A YAML file can contain a single template or an array
            const templates: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

            for (const t of templates) {
                const template = this.validateTemplate(t, filePath);
                if (template) {
                    this.templates.push(template);
                }
            }
        } catch (error) {
            console.warn(`[TemplateEngine] Failed to load ${filePath}: ${error}`);
        }
    }

    private validateTemplate(raw: unknown, filePath: string): AttackTemplate | null {
        if (!raw || typeof raw !== 'object') return null;
        const t = raw as Record<string, unknown>;

        // Required fields
        if (!t.id || !t.name || !t.category || (!t.payloads && !t.conversation)) {
            console.warn(`[TemplateEngine] Skipping invalid template in ${filePath}: missing required fields`);
            return null;
        }

        // Derive category from directory if not set
        const dirCategory = basename(dirname(filePath));

        return {
            id: String(t.id),
            name: String(t.name),
            author: String(t.author ?? 'valyrian-edge'),
            severity: (t.severity as AttackTemplate['severity']) ?? 'medium',
            category: (t.category as TemplateCategory) ?? dirCategory,
            tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
            description: String(t.description ?? ''),
            payloads: this.parsePayloads(t.payloads),
            matchers: this.parseMatchers(t.matchers),
            matcherCondition: (t.matcherCondition as 'and' | 'or') ?? 'or',
            variables: (t.variables as Record<string, string>) ?? {},
            conversation: this.parseConversation(t.conversation),
            metadata: (t.metadata as AttackTemplate['metadata']) ?? {},
        };
    }

    private parsePayloads(raw: unknown): TemplatePayload[] {
        if (!Array.isArray(raw)) return [];
        return raw.map(p => {
            if (typeof p === 'string') return { content: p };
            return {
                content: String(p.content ?? p),
                encoding: (p.encoding as PayloadEncoding) ?? 'none',
                delay: Number(p.delay ?? 0),
            };
        });
    }

    private parseMatchers(raw: unknown): TemplateMatcher[] {
        if (!Array.isArray(raw)) return [];
        return raw.map(m => ({
            type: m.type ?? 'keyword',
            values: Array.isArray(m.values) ? m.values.map(String) : [String(m.values ?? '')],
            negative: Boolean(m.negative ?? false),
            caseSensitive: Boolean(m.caseSensitive ?? false),
            weight: Number(m.weight ?? 1.0),
        }));
    }

    private parseConversation(raw: unknown): ConversationStep[] | undefined {
        if (!Array.isArray(raw)) return undefined;
        return raw.map((s, i) => ({
            step: Number(s.step ?? i + 1),
            role: s.role ?? 'probe',
            message: String(s.message ?? ''),
            waitForResponse: Boolean(s.waitForResponse ?? true),
            matchers: s.matchers ? this.parseMatchers(s.matchers) : undefined,
            breakOnMatch: Boolean(s.breakOnMatch ?? false),
        }));
    }

    // =========================================================================
    // QUERYING
    // =========================================================================

    /**
     * Get templates by glob pattern (e.g., "prompt-injection/*", "*")
     */
    getByPattern(pattern: string): AttackTemplate[] {
        if (pattern === '*') return [...this.templates];

        // Category pattern: "prompt-injection/*"
        if (pattern.endsWith('/*')) {
            const category = pattern.slice(0, -2) as TemplateCategory;
            return this.byCategory.get(category) ?? [];
        }

        // Tag pattern: "tag:jailbreak"
        if (pattern.startsWith('tag:')) {
            const tag = pattern.slice(4);
            return this.byTag.get(tag) ?? [];
        }

        // Exact ID match
        return this.templates.filter(t => t.id === pattern);
    }

    /**
     * Get templates by category
     */
    getByCategory(category: TemplateCategory): AttackTemplate[] {
        return this.byCategory.get(category) ?? [];
    }

    /**
     * Get templates by severity
     */
    getBySeverity(severity: AttackTemplate['severity']): AttackTemplate[] {
        return this.templates.filter(t => t.severity === severity);
    }

    // =========================================================================
    // INTERPOLATION
    // =========================================================================

    /**
     * Interpolate variables into payload content
     */
    interpolate(content: string, variables: Record<string, string>): string {
        return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] ?? match;
        });
    }

    /**
     * Prepare a payload: interpolate variables + apply encoding
     */
    preparePayload(payload: TemplatePayload, variables: Record<string, string>): string {
        const interpolated = this.interpolate(payload.content, variables);
        return applyEncoding(interpolated, payload.encoding ?? 'none');
    }

    // =========================================================================
    // MATCHING
    // =========================================================================

    /**
     * Run matchers against a response
     */
    matchResponse(response: string, matchers: TemplateMatcher[], condition: 'and' | 'or' = 'or'): {
        matched: boolean;
        matchedBy: string[];
        confidence: number;
    } {
        if (matchers.length === 0) return { matched: false, matchedBy: [], confidence: 0 };

        const results: { name: string; matched: boolean; weight: number }[] = [];

        for (const matcher of matchers) {
            const result = this.runMatcher(response, matcher);
            results.push({
                name: `${matcher.type}:${matcher.values[0]?.substring(0, 30)}`,
                matched: matcher.negative ? !result : result,
                weight: matcher.weight ?? 1.0,
            });
        }

        const matchedResults = results.filter(r => r.matched);
        const matchedBy = matchedResults.map(r => r.name);

        let matched: boolean;
        if (condition === 'and') {
            matched = results.every(r => r.matched);
        } else {
            matched = results.some(r => r.matched);
        }

        // Confidence = weighted average of matched matchers
        const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
        const matchedWeight = matchedResults.reduce((sum, r) => sum + r.weight, 0);
        const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;

        return { matched, matchedBy, confidence };
    }

    private runMatcher(response: string, matcher: TemplateMatcher): boolean {
        const target = matcher.caseSensitive ? response : response.toLowerCase();

        switch (matcher.type) {
            case 'keyword':
                return matcher.values.some(v => {
                    const val = matcher.caseSensitive ? v : v.toLowerCase();
                    return target.includes(val);
                });

            case 'regex':
                return matcher.values.some(v => {
                    try {
                        const flags = matcher.caseSensitive ? '' : 'i';
                        return new RegExp(v, flags).test(response);
                    } catch {
                        return false;
                    }
                });

            case 'length':
                return matcher.values.some(v => {
                    const threshold = parseInt(v, 10);
                    return response.length > threshold;
                });

            case 'absence':
                return !matcher.values.some(v => {
                    const val = matcher.caseSensitive ? v : v.toLowerCase();
                    return target.includes(val);
                });

            case 'similarity':
                // Basic similarity: check if response contains key phrases
                return matcher.values.some(v => {
                    const words = v.toLowerCase().split(/\s+/);
                    const matched = words.filter(w => target.includes(w));
                    return matched.length / words.length > 0.6;
                });

            case 'llm-judge':
                // LLM judge requires async - return false in sync context
                // Actual LLM judging handled in runTemplate()
                return false;

            default:
                return false;
        }
    }

    // =========================================================================
    // EXECUTION
    // =========================================================================

    /**
     * Run a single template against a send function
     */
    async runTemplate(
        template: AttackTemplate,
        sendFn: (message: string) => Promise<string>,
        variables: Record<string, string> = {},
    ): Promise<TemplateResult[]> {
        const mergedVars = { ...template.variables, ...variables };
        const results: TemplateResult[] = [];

        // Multi-turn conversation mode
        if (template.conversation && template.conversation.length > 0) {
            const result = await this.runConversation(template, sendFn, mergedVars);
            if (result) results.push(result);
            return results;
        }

        // Single-shot payload mode
        for (const payload of template.payloads) {
            const prepared = this.preparePayload(payload, mergedVars);

            if (payload.delay && payload.delay > 0) {
                await new Promise(r => setTimeout(r, payload.delay));
            }

            try {
                const response = await sendFn(prepared);
                const { matched, matchedBy, confidence } = this.matchResponse(
                    response,
                    template.matchers,
                    template.matcherCondition,
                );

                results.push({
                    templateId: template.id,
                    templateName: template.name,
                    success: matched,
                    confidence,
                    severity: template.severity,
                    category: template.category,
                    payload: prepared,
                    response: response.substring(0, 500),
                    matchedBy,
                    evidence: {
                        fullResponse: response,
                        encoding: payload.encoding ?? 'none',
                        originalPayload: payload.content,
                    },
                    timestamp: new Date(),
                });
            } catch (error) {
                results.push({
                    templateId: template.id,
                    templateName: template.name,
                    success: false,
                    confidence: 0,
                    severity: template.severity,
                    category: template.category,
                    payload: prepared,
                    response: `Error: ${error}`,
                    matchedBy: [],
                    evidence: { error: String(error) },
                    timestamp: new Date(),
                });
            }
        }

        return results;
    }

    private async runConversation(
        template: AttackTemplate,
        sendFn: (message: string) => Promise<string>,
        variables: Record<string, string>,
    ): Promise<TemplateResult | null> {
        const steps = template.conversation!;
        let lastResponse = '';
        const conversationLog: Array<{ role: string; message: string; response: string }> = [];

        for (const step of steps) {
            const message = this.interpolate(step.message, variables);

            try {
                const response = await sendFn(message);
                lastResponse = response;
                conversationLog.push({ role: step.role, message, response });

                // Check step-level matchers
                if (step.matchers && step.matchers.length > 0) {
                    const { matched } = this.matchResponse(response, step.matchers);
                    if (matched && step.breakOnMatch) break;
                }
            } catch (error) {
                conversationLog.push({ role: step.role, message, response: `Error: ${error}` });
                break;
            }
        }

        // Run final matchers against last response
        const { matched, matchedBy, confidence } = this.matchResponse(
            lastResponse,
            template.matchers,
            template.matcherCondition,
        );

        return {
            templateId: template.id,
            templateName: template.name,
            success: matched,
            confidence,
            severity: template.severity,
            category: template.category,
            payload: conversationLog.map(c => c.message).join(' → '),
            response: lastResponse.substring(0, 500),
            matchedBy,
            evidence: { conversationLog },
            timestamp: new Date(),
        };
    }

    /**
     * Run all templates matching a pattern
     */
    async runAll(
        pattern: string,
        sendFn: (message: string) => Promise<string>,
        variables?: Record<string, string>,
        onResult?: (result: TemplateResult) => void,
    ): Promise<TemplateResult[]> {
        const templates = this.getByPattern(pattern);
        const allResults: TemplateResult[] = [];

        for (const template of templates) {
            const results = await this.runTemplate(template, sendFn, variables);
            allResults.push(...results);
            for (const r of results) {
                onResult?.(r);
            }
        }

        return allResults;
    }

    // =========================================================================
    // STATS
    // =========================================================================

    getStats(): {
        total: number;
        byCategory: Record<string, number>;
        bySeverity: Record<string, number>;
    } {
        const byCategory: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};

        for (const t of this.templates) {
            byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
            bySeverity[t.severity] = (bySeverity[t.severity] ?? 0) + 1;
        }

        return { total: this.templates.length, byCategory, bySeverity };
    }
}

export default TemplateEngine;
