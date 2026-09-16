import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

// The script loads the filters compiler on start, which takes a few seconds.
const SPAWN_TIMEOUT_MS = 30_000;

const SCRIPT_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../validate_platforms.js',
);

describe('validate_platforms.js', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-platforms-'));
        fs.mkdirSync(path.join(tmpDir, 'platforms'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const runScript = (platformsArg: string): SpawnSyncReturns<string> => spawnSync(
        process.execPath,
        [SCRIPT_PATH, platformsArg],
        { cwd: tmpDir, encoding: 'utf-8' },
    );

    it('resolves a relative platforms path against the working directory', () => {
        const result = runScript('./platforms');

        expect(result.stderr).not.toContain('Invalid filters json');
        expect(result.status).toBe(0);
    }, SPAWN_TIMEOUT_MS);

    it('accepts an absolute platforms path', () => {
        const result = runScript(path.join(tmpDir, 'platforms'));

        expect(result.stderr).not.toContain('Invalid filters json');
        expect(result.status).toBe(0);
    }, SPAWN_TIMEOUT_MS);
});
