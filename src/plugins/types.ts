/**
 * Valyrian Edge - Plugin System Types
 */

import { z } from 'zod';

// =============================================================================
// PLUGIN MANIFEST (validated with Zod)
// =============================================================================

export const PluginManifestSchema = z.object({
    /** Unique plugin identifier, e.g. "my-org/my-plugin" */
    id: z.string().min(1),
    /** Human-readable name */
    name: z.string().min(1),
    /** Semver version string */
    version: z.string().regex(/^\d+\.\d+\.\d+/),
    /** Short description */
    description: z.string(),
    /** Plugin author */
    author: z.string().optional(),
    /** Repository URL */
    repository: z.string().url().optional(),
    /** What this plugin provides */
    contributes: z.object({
        /** Paths (relative to plugin root) to additional YAML template files */
        templates: z.array(z.string()).optional(),
        /** Agent class names exported by the plugin's main entry point */
        agents: z.array(z.string()).optional(),
    }).optional(),
    /** Main entry point (relative to plugin root) */
    main: z.string().optional(),
    /** Minimum valyrian-edge version required */
    engines: z.object({
        valyrianEdge: z.string().optional(),
    }).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// =============================================================================
// LOADED PLUGIN
// =============================================================================

export interface LoadedPlugin {
    manifest: PluginManifest;
    /** Absolute path to the plugin directory */
    pluginDir: string;
    /** Absolute paths to discovered template files */
    templateFiles: string[];
}

// =============================================================================
// REGISTRY ENTRY
// =============================================================================

export interface RegistryEntry {
    id: string;
    name: string;
    version: string;
    description: string;
    author?: string;
    repository: string;
    tags?: string[];
    downloads?: number;
}

export interface RegistryIndex {
    plugins: RegistryEntry[];
    updatedAt: string;
}
