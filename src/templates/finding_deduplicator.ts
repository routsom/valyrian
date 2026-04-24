/**
 * Valyrian Edge - Finding Deduplicator
 * Deduplicates and consolidates security findings from multiple templates/agents
 */

import type { TemplateResult } from './template.types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DeduplicationOptions {
    /** Similarity threshold for fuzzy matching (0.0 - 1.0) */
    similarityThreshold?: number;
    /** Whether to merge evidence from duplicates */
    mergeEvidence?: boolean;
    /** Max results to keep per category */
    maxPerCategory?: number;
    /** Prefer higher confidence findings */
    preferHighConfidence?: boolean;
}

export interface ConsolidatedFinding {
    /** Unique deduplicated ID */
    id: string;
    /** Best template result (highest confidence) */
    primary: TemplateResult;
    /** Number of duplicate findings merged */
    duplicateCount: number;
    /** All template IDs that produced this finding */
    sourceTemplates: string[];
    /** Merged evidence from all duplicates */
    mergedEvidence: Record<string, unknown>;
    /** Aggregated confidence (boosted by multiple confirms) */
    aggregatedConfidence: number;
    /** Effective severity (may be upgraded based on evidence) */
    effectiveSeverity: TemplateResult['severity'];
}

export interface DeduplicationReport {
    /** Unique findings after deduplication */
    findings: ConsolidatedFinding[];
    /** Total input results */
    totalInput: number;
    /** Total after dedup */
    totalOutput: number;
    /** Number removed as duplicates */
    duplicatesRemoved: number;
    /** Stats by category */
    byCategory: Record<string, number>;
    /** Stats by severity */
    bySeverity: Record<string, number>;
}

// =============================================================================
// FINDING DEDUPLICATOR
// =============================================================================

export class FindingDeduplicator {
    private options: Required<DeduplicationOptions>;

    constructor(options: DeduplicationOptions = {}) {
        this.options = {
            similarityThreshold: options.similarityThreshold ?? 0.7,
            mergeEvidence: options.mergeEvidence ?? true,
            maxPerCategory: options.maxPerCategory ?? 50,
            preferHighConfidence: options.preferHighConfidence ?? true,
        };
    }

    /**
     * Deduplicate a list of template results
     */
    deduplicate(results: TemplateResult[]): DeduplicationReport {
        // Phase 1: Filter out non-successful findings
        const successfulResults = results.filter(r => r.success);
        // Failed results are excluded from deduplication

        // Phase 2: Group by exact template ID
        const byTemplate = this.groupByTemplate(successfulResults);

        // Phase 3: Fuzzy-match across different templates
        const clusters = this.clusterSimilar(byTemplate);

        // Phase 4: Consolidate each cluster into a single finding
        let findings = clusters.map(cluster => this.consolidateCluster(cluster));

        // Phase 5: Category limits
        findings = this.applyCategoryLimits(findings);

        // Phase 6: Sort by severity then confidence
        findings.sort((a, b) => {
            const sevOrder = this.severityOrder(b.effectiveSeverity) - this.severityOrder(a.effectiveSeverity);
            if (sevOrder !== 0) return sevOrder;
            return b.aggregatedConfidence - a.aggregatedConfidence;
        });

        // Build report
        const byCategory: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        for (const f of findings) {
            byCategory[f.primary.category] = (byCategory[f.primary.category] ?? 0) + 1;
            bySeverity[f.effectiveSeverity] = (bySeverity[f.effectiveSeverity] ?? 0) + 1;
        }

        return {
            findings,
            totalInput: results.length,
            totalOutput: findings.length,
            duplicatesRemoved: successfulResults.length - findings.length,
            byCategory,
            bySeverity,
        };
    }

    /**
     * Quick check if two results are likely duplicates
     */
    isDuplicate(a: TemplateResult, b: TemplateResult): boolean {
        // Same template = definitely duplicate
        if (a.templateId === b.templateId) return true;

        // Different category = not duplicate
        if (a.category !== b.category) return false;

        // Compare payloads
        const payloadSimilarity = this.stringSimilarity(a.payload, b.payload);
        if (payloadSimilarity > this.options.similarityThreshold) return true;

        // Compare matched-by patterns
        const matcherOverlap = this.setOverlap(a.matchedBy, b.matchedBy);
        if (matcherOverlap > 0.8) return true;

        // Compare responses
        const responseSimilarity = this.stringSimilarity(a.response, b.response);
        if (responseSimilarity > 0.85) return true;

        return false;
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    private groupByTemplate(results: TemplateResult[]): Map<string, TemplateResult[]> {
        const groups = new Map<string, TemplateResult[]>();
        for (const r of results) {
            const list = groups.get(r.templateId) ?? [];
            list.push(r);
            groups.set(r.templateId, list);
        }
        return groups;
    }

    private clusterSimilar(groups: Map<string, TemplateResult[]>): TemplateResult[][] {
        // Pick the best result from each template group
        const representatives: TemplateResult[] = [];
        for (const [, results] of groups) {
            const best = this.pickBest(results);
            if (best) representatives.push(best);
        }

        // Cluster similar representatives
        const clusters: TemplateResult[][] = [];
        const assigned = new Set<number>();

        for (let i = 0; i < representatives.length; i++) {
            if (assigned.has(i)) continue;

            const cluster: TemplateResult[] = [representatives[i]!];
            assigned.add(i);

            for (let j = i + 1; j < representatives.length; j++) {
                if (assigned.has(j)) continue;

                if (this.isDuplicate(representatives[i]!, representatives[j]!)) {
                    cluster.push(representatives[j]!);
                    assigned.add(j);
                }
            }

            clusters.push(cluster);
        }

        return clusters;
    }

    private consolidateCluster(cluster: TemplateResult[]): ConsolidatedFinding {
        // Pick primary (highest confidence)
        const sorted = [...cluster].sort((a, b) => b.confidence - a.confidence);
        const primary = sorted[0]!;

        // Merge evidence
        const mergedEvidence: Record<string, unknown> = {};
        if (this.options.mergeEvidence) {
            for (const result of cluster) {
                for (const [key, value] of Object.entries(result.evidence)) {
                    if (!(key in mergedEvidence)) {
                        mergedEvidence[key] = value;
                    } else if (Array.isArray(mergedEvidence[key]) && Array.isArray(value)) {
                        mergedEvidence[key] = [
                            ...(mergedEvidence[key] as unknown[]),
                            ...value,
                        ];
                    }
                }
            }
        }

        // Aggregate confidence — multiple confirmations boost confidence
        const baseConfidence = primary.confidence;
        const confirmationBoost = Math.min(0.15, (cluster.length - 1) * 0.05);
        const aggregatedConfidence = Math.min(1.0, baseConfidence + confirmationBoost);

        // Determine effective severity — upgrade if high confidence + multiple confirmations
        let effectiveSeverity = primary.severity;
        if (cluster.length >= 3 && aggregatedConfidence > 0.8) {
            effectiveSeverity = this.upgradeSeverity(primary.severity);
        }

        return {
            id: `finding_${primary.category}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            primary,
            duplicateCount: cluster.length,
            sourceTemplates: cluster.map(r => r.templateId),
            mergedEvidence,
            aggregatedConfidence,
            effectiveSeverity,
        };
    }

    private applyCategoryLimits(findings: ConsolidatedFinding[]): ConsolidatedFinding[] {
        const { maxPerCategory } = this.options;
        const byCategory = new Map<string, ConsolidatedFinding[]>();

        for (const f of findings) {
            const list = byCategory.get(f.primary.category) ?? [];
            list.push(f);
            byCategory.set(f.primary.category, list);
        }

        const result: ConsolidatedFinding[] = [];
        for (const [, categoryFindings] of byCategory) {
            // Sort by aggregated confidence and take top N
            categoryFindings.sort((a, b) => b.aggregatedConfidence - a.aggregatedConfidence);
            result.push(...categoryFindings.slice(0, maxPerCategory));
        }

        return result;
    }

    private pickBest(results: TemplateResult[]): TemplateResult | undefined {
        if (results.length === 0) return undefined;
        if (this.options.preferHighConfidence) {
            return results.reduce((best, r) => r.confidence > best.confidence ? r : best);
        }
        return results[0];
    }

    /**
     * Simple string similarity using bigram overlap (Dice coefficient)
     */
    private stringSimilarity(a: string, b: string): number {
        if (a === b) return 1;
        if (a.length < 2 || b.length < 2) return 0;

        const aBigrams = this.getBigrams(a.toLowerCase());
        const bBigrams = this.getBigrams(b.toLowerCase());

        let overlap = 0;
        const bCopy = new Map(bBigrams);

        for (const [bigram, count] of aBigrams) {
            const bCount = bCopy.get(bigram) ?? 0;
            if (bCount > 0) {
                overlap += Math.min(count, bCount);
                bCopy.set(bigram, bCount - Math.min(count, bCount));
            }
        }

        const totalA = [...aBigrams.values()].reduce((s, v) => s + v, 0);
        const totalB = [...bBigrams.values()].reduce((s, v) => s + v, 0);

        return (2 * overlap) / (totalA + totalB);
    }

    private getBigrams(str: string): Map<string, number> {
        const bigrams = new Map<string, number>();
        for (let i = 0; i < str.length - 1; i++) {
            const bigram = str.substring(i, i + 2);
            bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
        }
        return bigrams;
    }

    private setOverlap(a: string[], b: string[]): number {
        if (a.length === 0 && b.length === 0) return 0;
        const setA = new Set(a);
        const setB = new Set(b);
        let overlap = 0;
        for (const item of setA) {
            if (setB.has(item)) overlap++;
        }
        return (2 * overlap) / (setA.size + setB.size);
    }

    private severityOrder(severity: string): number {
        const order: Record<string, number> = {
            critical: 4, high: 3, medium: 2, low: 1, info: 0,
        };
        return order[severity] ?? 0;
    }

    private upgradeSeverity(severity: string): TemplateResult['severity'] {
        const upgrades: Record<string, TemplateResult['severity']> = {
            info: 'low',
            low: 'medium',
            medium: 'high',
            high: 'critical',
            critical: 'critical',
        };
        return upgrades[severity] ?? severity as TemplateResult['severity'];
    }
}

export default FindingDeduplicator;
