/**
 * Valyrian Edge - Agent Exports
 */

export { BaseAgent } from './base_agent.js';
export { ReconAgent } from './recon_agent.js';
export { PromptInjectionAgent } from './prompt_injection_agent.js';
export { ToolAbuseAgent } from './tool_abuse_agent.js';
export { DataExfiltrationAgent } from './data_exfiltration_agent.js';
export { RAGPoisoningAgent } from './rag_poisoning_agent.js';
export { DoSAgent } from './dos_agent.js';
export { ExcessiveAgencyAgent } from './excessive_agency_agent.js';
export { InsecureOutputAgent } from './insecure_output_agent.js';
export { SupplyChainAgent } from './supply_chain_agent.js';
export { OverrelianceAgent } from './overreliance_agent.js';
export { ModelTheftAgent } from './model_theft_agent.js';

// LLM Client exports
export {
    createLLMClient,
    createAnthropicClient,
    chat,
    streamChat,
    toLangChainMessages,
} from './llm_client.js';
export type {
    LLMClientOptions,
    ChatMessage,
    ChatOptions,
    ChatResponse
} from './llm_client.js';
