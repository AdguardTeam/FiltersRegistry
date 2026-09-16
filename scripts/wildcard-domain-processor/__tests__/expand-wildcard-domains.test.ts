import {
    describe, it, vi, expect, beforeEach, afterEach,
} from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { expandWildcardDomains } from '../wildcard-expander.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FILTER_CONTENT = [
    'example.*##h1',
    '||ads.example.net^$domain=example.*',
    '',
].join('\n');

describe('expandWildcardDomains', () => {
    let tempDir: string;
    let platformsDir: string;
    let filterPath: string;
    let wildcardDomainsPath: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wildcard-expander-'));
        platformsDir = path.join(tempDir, 'platforms');
        filterPath = path.join(platformsDir, 'filters', '2.txt');
        wildcardDomainsPath = path.join(tempDir, 'wildcard_domains.json');

        await fs.mkdir(path.dirname(filterPath), { recursive: true });
        await fs.writeFile(filterPath, FILTER_CONTENT, 'utf8');
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('expands wildcards in platform filters', async () => {
        // The shape written by `update-wildcard-domains`: the map of alive domains
        // is stored under the 'alive' key, next to 'timeUpdated' and 'dead'.
        await fs.writeFile(wildcardDomainsPath, JSON.stringify({
            timeUpdated: '2025-07-02T21:57:14.568Z',
            alive: { 'example.*': ['example.com', 'example.org'] },
            dead: [],
        }), 'utf8');

        await expandWildcardDomains(platformsDir, wildcardDomainsPath);

        const updatedFilter = await fs.readFile(filterPath, 'utf8');

        expect(updatedFilter).toBe([
            'example.com,example.org##h1',
            '||ads.example.net^$domain=example.com|example.org',
            '',
        ].join('\n'));
    });

    it('expands wildcards when the domains are stored in the old flat format', async () => {
        await fs.writeFile(
            wildcardDomainsPath,
            JSON.stringify({ 'example.*': ['example.com', 'example.org'] }),
            'utf8',
        );

        await expandWildcardDomains(platformsDir, wildcardDomainsPath);

        const updatedFilter = await fs.readFile(filterPath, 'utf8');

        expect(updatedFilter).toContain('example.com,example.org##h1');
    });
});

describe('wildcard-domain-processor command line interface', () => {
    const originalArgv = process.argv;

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        process.argv = originalArgv;
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('runs the requested command when the module is invoked by its directory', async () => {
        const expandWildcardDomainsMock = vi.fn().mockResolvedValue(undefined);
        vi.doMock('../wildcard-expander.js', () => ({
            expandWildcardDomains: expandWildcardDomainsMock,
        }));
        vi.doMock('../wildcard-domains-updater.js', () => ({
            updateWildcardDomains: vi.fn().mockResolvedValue(undefined),
        }));

        // `yarn expand-wildcard-domains` runs `tsx scripts/wildcard-domain-processor <args>`,
        // so the entry point reported by Node is the directory, not index.ts itself.
        process.argv = [
            process.execPath,
            path.resolve(__dirname, '..'),
            'expand-wildcard-domains',
            './platforms/ios',
            './scripts/wildcard-domain-processor/wildcard_domains.json',
        ];

        await import('../index.js');

        await vi.waitFor(() => expect(expandWildcardDomainsMock).toHaveBeenCalledTimes(1));
    });
});
