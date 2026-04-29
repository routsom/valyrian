/**
 * Valyrian Edge - Plugin Registry Client
 * Fetches the community plugin index from the registry URL and provides
 * search/list functionality. Uses Node.js built-in https — no extra deps.
 */

import { get } from 'node:https';
import type { RegistryIndex, RegistryEntry } from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('plugin-registry');

const DEFAULT_REGISTRY_URL =
    process.env['VALYRIAN_REGISTRY_URL'] ??
    'https://raw.githubusercontent.com/valyrian-security/valyrian-edge/main/registry.json';

export class RegistryClient {
    constructor(private readonly registryUrl = DEFAULT_REGISTRY_URL) {}

    /** Fetch the full plugin index. */
    async fetchIndex(): Promise<RegistryIndex> {
        return new Promise((resolve, reject) => {
            get(this.registryUrl, res => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Registry fetch failed with status ${res.statusCode}`));
                    return;
                }
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    try {
                        const raw = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as RegistryIndex;
                        resolve(raw);
                    } catch (err) {
                        reject(new Error(`Failed to parse registry JSON: ${err}`));
                    }
                });
            }).on('error', reject);
        });
    }

    /** Search plugins by keyword (matches id, name, description, tags). */
    async search(query: string): Promise<RegistryEntry[]> {
        const index = await this.fetchIndex();
        const q = query.toLowerCase();
        return index.plugins.filter(p =>
            p.id.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            (p.tags ?? []).some(t => t.toLowerCase().includes(q)),
        );
    }

    /** Find a plugin by exact id. */
    async findById(id: string): Promise<RegistryEntry | null> {
        const index = await this.fetchIndex();
        return index.plugins.find(p => p.id === id) ?? null;
    }

    /** List all available plugins. */
    async listAll(): Promise<RegistryEntry[]> {
        const index = await this.fetchIndex();
        logger.debug({ count: index.plugins.length, updatedAt: index.updatedAt }, 'Registry fetched');
        return index.plugins;
    }
}
