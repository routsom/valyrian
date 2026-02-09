/**
 * Valyrian Edge - LLM Client
 * Unified LLM client supporting Anthropic, OpenAI, and Ollama
 */

import Anthropic from '@anthropic-ai/sdk';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { LLMConfig } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('llm-client');

// =============================================================================
// LLM CLIENT FACTORY
// =============================================================================

export interface LLMClientOptions {
    config: LLMConfig;
    streaming?: boolean;
}

/**
 * Create a LangChain chat model based on configuration
 */
export function createLLMClient(options: LLMClientOptions): BaseChatModel {
    const { config, streaming = false } = options;

    logger.info({ provider: config.provider, model: config.model }, 'Creating LLM client');

    switch (config.provider) {
        case 'anthropic':
            if (!config.apiKey) {
                throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable.');
            }
            return new ChatAnthropic({
                anthropicApiKey: config.apiKey,
                model: config.model,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                streaming,
            });

        case 'openai':
            if (!config.apiKey) {
                throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
            }
            return new ChatOpenAI({
                openAIApiKey: config.apiKey,
                model: config.model,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                streaming,
            });

        case 'ollama':
            return new ChatOllama({
                baseUrl: config.ollamaBaseUrl ?? 'http://localhost:11434',
                model: config.model,
                temperature: config.temperature,
            });

        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
}

// =============================================================================
// DIRECT ANTHROPIC CLIENT (for tool use)
// =============================================================================

export function createAnthropicClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
}

// =============================================================================
// MESSAGE CONVERSION
// =============================================================================

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Convert simple messages to LangChain format
 */
export function toLangChainMessages(messages: ChatMessage[]): Array<SystemMessage | HumanMessage | AIMessage> {
    return messages.map(msg => {
        switch (msg.role) {
            case 'system':
                return new SystemMessage(msg.content);
            case 'user':
                return new HumanMessage(msg.content);
            case 'assistant':
                return new AIMessage(msg.content);
        }
    });
}

// =============================================================================
// SIMPLE CHAT INTERFACE
// =============================================================================

export interface ChatOptions {
    messages: ChatMessage[];
    systemPrompt?: string;
}

export interface ChatResponse {
    content: string;
    tokenUsage?: {
        input: number;
        output: number;
        total: number;
    };
}

/**
 * Simple chat completion interface
 */
export async function chat(
    client: BaseChatModel,
    options: ChatOptions
): Promise<ChatResponse> {
    const { messages, systemPrompt } = options;

    const langchainMessages = [];

    if (systemPrompt) {
        langchainMessages.push(new SystemMessage(systemPrompt));
    }

    langchainMessages.push(...toLangChainMessages(messages));

    const startTime = Date.now();
    const response = await client.invoke(langchainMessages);
    const duration = Date.now() - startTime;

    logger.debug({ duration, messageCount: messages.length }, 'Chat completion');

    const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    return {
        content,
        tokenUsage: response.usage_metadata ? {
            input: response.usage_metadata.input_tokens,
            output: response.usage_metadata.output_tokens,
            total: response.usage_metadata.total_tokens,
        } : undefined,
    };
}

// =============================================================================
// STREAMING CHAT
// =============================================================================

export async function* streamChat(
    client: BaseChatModel,
    options: ChatOptions
): AsyncGenerator<string, void, unknown> {
    const { messages, systemPrompt } = options;

    const langchainMessages = [];

    if (systemPrompt) {
        langchainMessages.push(new SystemMessage(systemPrompt));
    }

    langchainMessages.push(...toLangChainMessages(messages));

    const stream = await client.stream(langchainMessages);

    for await (const chunk of stream) {
        const content = typeof chunk.content === 'string'
            ? chunk.content
            : '';
        if (content) {
            yield content;
        }
    }
}

export default { createLLMClient, createAnthropicClient, chat, streamChat, toLangChainMessages };
