/**
 * Valyrian Edge - Plugin Loader
 * Discovers installed plugins from ~/.valyrian/plugins/ and ./valyrian-plugins/,
 * validates their manifests, and returns LoadedPlugin records.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { PluginManifestSchema, type LoadedPlugin } from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('plugin-loader');

export const MANIFEST_FILENAME = 'valyrian-plugin.json';

function defaultPluginDirs(): string[] {
    return [
        join(homedir(), '.valyrian', 'plugins'),
        resolve('./valyrian-plugins'),
    ];
}

export class PluginLoader {
    private readonly pluginDirs: string[];

    constructor(pluginDirs?: string[]) {
        this.pluginDirs = pluginDirs ?? defaultPluginDirs();
    }

    /**
     * Discover and load all valid plugins from configured directories.
     * Invalid plugins are logged and skipped — never throws.
     */
    loadAll(): LoadedPlugin[] {
        const loaded: LoadedPlugin[] = [];

        for (const dir of this.pluginDirs) {
            if (!existsSync(dir)) continue;

            let entries: string[];
            try {
                entries = readdirSync(dir, { withFileTypes: true })
                    .filter(d => d.isDirectory())
                    .map(d => d.name);
            } catch (err) {
                logger.warn({ dir, err }, 'Failed to read plugin directory');
                continue;
            }

            for (const entry of entries) {
                const plugin = this.loadOne(join(dir, entry));
                if (plugin) loaded.push(plugin);
            }
        }

        logger.info({ count: loaded.length }, 'Plugins loaded');
        return loaded;
    }

    /**
     * Load a single plugin from a directory path.
     * Returns null if the manifest is missing or invalid.
     */
    loadOne(pluginDir: string): LoadedPlugin | null {
        const manifestPath = join(pluginDir, MANIFEST_FILENAME);
        if (!existsSync(manifestPath)) return null;

        let raw: unknown;
        try {
            raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        } catch (err) {
            logger.warn({ pluginDir, err }, 'Failed to parse plugin manifest');
            return null;
        }

        const parsed = PluginManifestSchema.safeParse(raw);
        if (!parsed.success) {
            logger.warn({ pluginDir, errors: parsed.error.flatten() }, 'Invalid plugin manifest');
            return null;
        }

        const manifest = parsed.data;

        const templateFiles: string[] = [];
        for (const tpl of manifest.contributes?.templates ?? []) {
            const abs = resolve(pluginDir, tpl);
            if (existsSync(abs)) {
                templateFiles.push(abs);
            } else {
                logger.warn({ pluginDir, tpl }, 'Plugin template file not found');
            }
        }

        logger.debug({ id: manifest.id, version: manifest.version }, 'Plugin loaded');
        return { manifest, pluginDir, templateFiles };
    }
}
