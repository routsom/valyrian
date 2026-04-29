/**
 * Plugin Loader + Schema Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PluginLoader, MANIFEST_FILENAME } from '../../src/plugins/loader.js';
import { PluginManifestSchema } from '../../src/plugins/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validManifest = {
    id: 'test-org/test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin for unit tests',
    author: 'Test Author',
    repository: 'https://github.com/test-org/test-plugin',
    contributes: { templates: [], agents: [] },
};

let tmpBase: string;
let pluginsDir: string;

beforeEach(() => {
    tmpBase = join(tmpdir(), `valyrian-plugin-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    pluginsDir = join(tmpBase, 'plugins');
    mkdirSync(pluginsDir, { recursive: true });
});

afterEach(() => {
    if (existsSync(tmpBase)) rmSync(tmpBase, { recursive: true, force: true });
});

function createPlugin(dirName: string, manifest: object = validManifest): string {
    const dir = join(pluginsDir, dirName);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2), 'utf-8');
    return dir;
}

// ---------------------------------------------------------------------------
// PluginManifestSchema
// ---------------------------------------------------------------------------

describe('PluginManifestSchema', () => {
    it('accepts a valid manifest', () => {
        expect(PluginManifestSchema.safeParse(validManifest).success).toBe(true);
    });

    it('rejects manifest missing id', () => {
        const { id: _id, ...rest } = validManifest;
        expect(PluginManifestSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects manifest with invalid version format', () => {
        expect(PluginManifestSchema.safeParse({ ...validManifest, version: 'not-semver' }).success).toBe(false);
    });

    it('rejects manifest with non-URL repository', () => {
        expect(PluginManifestSchema.safeParse({ ...validManifest, repository: 'not-a-url' }).success).toBe(false);
    });

    it('accepts minimal manifest without optional fields', () => {
        const minimal = { id: 'x/y', name: 'Y', version: '0.1.0', description: 'minimal' };
        expect(PluginManifestSchema.safeParse(minimal).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// PluginLoader.loadOne
// ---------------------------------------------------------------------------

describe('PluginLoader.loadOne', () => {
    it('returns null when directory has no manifest', () => {
        const dir = join(pluginsDir, 'empty');
        mkdirSync(dir);
        expect(new PluginLoader([pluginsDir]).loadOne(dir)).toBeNull();
    });

    it('returns null when manifest is invalid JSON', () => {
        const dir = join(pluginsDir, 'bad-json');
        mkdirSync(dir);
        writeFileSync(join(dir, MANIFEST_FILENAME), 'NOT_JSON', 'utf-8');
        expect(new PluginLoader([pluginsDir]).loadOne(dir)).toBeNull();
    });

    it('returns null when manifest fails schema validation', () => {
        const dir = join(pluginsDir, 'bad-schema');
        mkdirSync(dir);
        writeFileSync(join(dir, MANIFEST_FILENAME), JSON.stringify({ id: '', name: 'X' }), 'utf-8');
        expect(new PluginLoader([pluginsDir]).loadOne(dir)).toBeNull();
    });

    it('returns a LoadedPlugin for a valid manifest', () => {
        const dir = createPlugin('valid');
        const plugin = new PluginLoader([pluginsDir]).loadOne(dir);
        expect(plugin).not.toBeNull();
        expect(plugin!.manifest.id).toBe('test-org/test-plugin');
        expect(plugin!.manifest.version).toBe('1.0.0');
        expect(plugin!.pluginDir).toBe(dir);
    });

    it('templateFiles is empty when no template paths listed', () => {
        const dir = createPlugin('no-templates');
        const plugin = new PluginLoader([pluginsDir]).loadOne(dir);
        expect(plugin!.templateFiles).toHaveLength(0);
    });

    it('templateFiles includes paths to existing template files', () => {
        const dir = join(pluginsDir, 'with-templates');
        mkdirSync(join(dir, 'templates'), { recursive: true });
        writeFileSync(join(dir, 'templates', 'attacks.yaml'), '# template', 'utf-8');
        writeFileSync(join(dir, MANIFEST_FILENAME), JSON.stringify({
            ...validManifest,
            contributes: { templates: ['templates/attacks.yaml'] },
        }), 'utf-8');
        const plugin = new PluginLoader([pluginsDir]).loadOne(dir);
        expect(plugin!.templateFiles).toHaveLength(1);
        expect(plugin!.templateFiles[0]).toContain('attacks.yaml');
    });
});

// ---------------------------------------------------------------------------
// PluginLoader.loadAll
// ---------------------------------------------------------------------------

describe('PluginLoader.loadAll', () => {
    it('returns empty array when plugins directory does not exist', () => {
        expect(new PluginLoader([join(tmpBase, 'nonexistent')]).loadAll()).toEqual([]);
    });

    it('loads multiple valid plugins', () => {
        createPlugin('plugin-a');
        createPlugin('plugin-b');
        expect(new PluginLoader([pluginsDir]).loadAll()).toHaveLength(2);
    });

    it('skips subdirectories without a manifest', () => {
        createPlugin('valid-plugin');
        mkdirSync(join(pluginsDir, 'no-manifest-dir'));
        expect(new PluginLoader([pluginsDir]).loadAll()).toHaveLength(1);
    });

    it('combines plugins from multiple search directories', () => {
        const dir2 = join(tmpBase, 'plugins2');
        mkdirSync(dir2);
        createPlugin('plugin-a');
        const p2 = join(dir2, 'plugin-b');
        mkdirSync(p2);
        writeFileSync(join(p2, MANIFEST_FILENAME), JSON.stringify({ ...validManifest, id: 'other/plugin-b' }), 'utf-8');
        expect(new PluginLoader([pluginsDir, dir2]).loadAll()).toHaveLength(2);
    });
});
