/**
 * Valyrian Edge — main package entry point.
 * Re-exports the full public SDK surface.
 */

export { ValyrianEdge, ScanSession } from './sdk/valyrian_edge.js';
export { DirectRunner } from './sdk/direct_runner.js';
export { TemporalRunner } from './sdk/temporal_runner.js';
export type {
    ScanOptions,
    ScanRunner,
    ScanState,
    ScanStatus,
    ScanEvent,
    ScanEventType,
    ScanEventHandler,
    ProgressEvent,
    FindingEvent,
    ValyrianEdgeOptions,
    RunnerMode,
    TargetProfile,
    LLMConfig,
    VulnerabilityType,
    SecurityReport,
    Finding,
} from './sdk/types.js';
