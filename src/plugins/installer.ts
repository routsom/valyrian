/**
 * Valyrian Edge - Plugin Installer
 * Installs and removes plugins by git-cloning repositories into
 * ~/.valyrian/plugins/<sanitized-id>/.
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { PluginLoader } from './loader.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('plugin-installer');

function defaultPluginsDir(): string {
    return join(homedir(), '.valyrian', 'plugins');
}

/** Sanitise a plugin id so it is safe to use as a directory name. */
function sanitiseId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

function execAsync(cmd: string, args: string[], cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { cwd }, (err, _stdout, stderr) => {
            if (err) {
                reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || err.message}`));
            } else {
                resolve();
            }
        });
    });
}

export class PluginInstaller {
    private readonly pluginsDir: string;

    constructor(pluginsDir?: string) {
        this.pluginsDir = pluginsDir ?? defaultPluginsDir();
    }

    /**
     * Install a plugin from a git repository URL.
     * @param id   Logical plugin id (used as directory name)
     * @param repo Git-clonable URL
     */
    async install(id: string, repo: string): Promise<void> {
        const targetDir = join(this.pluginsDir, sanitiseId(id));

        if (existsSync(targetDir)) {
            throw new Error(`Plugin '${id}' is already installed at ${targetDir}. Run remove first.`);
        }

        mkdirSync(this.pluginsDir, { recursive: true });

        logger.info({ id, repo, targetDir }, 'Installing plugin');
        await execAsync('git', ['clone', '--depth', '1', repo, targetDir]);

        // Validate manifest after clone
        const loader = new PluginLoader([this.pluginsDir]);
        const plugin = loader.loadOne(targetDir);
        if (!plugin) {
            rmSync(targetDir, { recursive: true, force: true });
            throw new Error('Cloned repository does not contain a valid valyrian-plugin.json');
        }

        logger.info({ id, version: plugin.manifest.version }, 'Plugin installed');
    }

    /** Remove an installed plugin by id. */
    remove(id: string): void {
        const targetDir = join(this.pluginsDir, sanitiseId(id));

        if (!existsSync(targetDir)) {
            throw new Error(`Plugin '${id}' is not installed`);
        }

        rmSync(targetDir, { recursive: true, force: true });
        logger.info({ id }, 'Plugin removed');
    }

    /** Update an installed plugin by running git pull. */
    async update(id: string): Promise<void> {
        const targetDir = join(this.pluginsDir, sanitiseId(id));

        if (!existsSync(targetDir)) {
            throw new Error(`Plugin '${id}' is not installed`);
        }

        logger.info({ id }, 'Updating plugin');
        await execAsync('git', ['pull', '--ff-only'], targetDir);
        logger.info({ id }, 'Plugin updated');
    }
}
