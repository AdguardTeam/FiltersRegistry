import {
    describe, it, expect, beforeAll, afterAll,
} from 'vitest';
import { compile, optimizationConfigLocal } from '@adguard/filters-compiler';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { findFiles } from '../../utils/find_files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_FILTER_DIR = path.resolve(__dirname, '../../../filters/filter_1_Russian');

const RULE_TO_FILTER = '||e2e-optimization-filtered.example^';
const RULE_TO_KEEP = '||e2e-optimization-kept.example^';
const FILTER_ID = 1;

const TEST_PLATFORM_CONFIG: Record<string, unknown> = {
    TEST: {
        platform: 'test',
        path: 'test',
        configuration: {
            ignoreRuleHints: false,
            replacements: null,
        },
        defines: {
            adguard: true,
        },
    },
};

describe('optimization config e2e', () => {
    let tmpDir: string;
    let allOutput: string;

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filters-e2e-'));

        const filtersDir = path.join(tmpDir, 'filters');
        const optimizationDir = path.join(tmpDir, 'optimization_config');
        const platformsDir = path.join(tmpDir, 'platforms');
        const logPath = path.join(tmpDir, 'log.txt');
        const reportPath = path.join(tmpDir, 'report.txt');

        const filterDir = path.join(filtersDir, 'filter_1_Russian');
        await fs.promises.mkdir(filterDir, { recursive: true });

        await fs.promises.copyFile(
            path.join(REAL_FILTER_DIR, 'metadata.json'),
            path.join(filterDir, 'metadata.json'),
        );
        await fs.promises.copyFile(
            path.join(REAL_FILTER_DIR, 'revision.json'),
            path.join(filterDir, 'revision.json'),
        );

        await fs.promises.writeFile(
            path.join(filterDir, 'template.txt'),
            `! Title: E2E Optimization Test\n${RULE_TO_FILTER}\n${RULE_TO_KEEP}\n`,
            'utf-8',
        );

        const statsDir = path.join(optimizationDir, 'filters', String(FILTER_ID));
        await fs.promises.mkdir(statsDir, { recursive: true });

        await fs.promises.writeFile(
            path.join(optimizationDir, 'percent.json'),
            JSON.stringify({ config: [{ filterId: FILTER_ID }] }),
            'utf-8',
        );

        // stats.json: RULE_TO_FILTER hits=0 < threshold=1 → filtered out
        //             RULE_TO_KEEP   hits=9999 ≥ threshold=1 → kept
        await fs.promises.writeFile(
            path.join(statsDir, 'stats.json'),
            JSON.stringify({
                percent: 40,
                minPercent: 25,
                maxPercent: 50,
                strict: true,
                groups: [{
                    config: { type: 'BASIC', scope: 'GENERIC', hits: 1 },
                    rules: {
                        [RULE_TO_FILTER]: 0,
                        [RULE_TO_KEEP]: 9999,
                    },
                }],
            }),
            'utf-8',
        );

        optimizationConfigLocal.setPath(optimizationDir);

        await compile(
            filtersDir,
            logPath,
            reportPath,
            platformsDir,
            [FILTER_ID],
            [],
            TEST_PLATFORM_CONFIG,
        );

        const outputFiles: string[] = await findFiles(platformsDir, () => true);
        const optimizedFiles = outputFiles.filter((f) => f.endsWith('_optimized.txt'));
        expect(optimizedFiles.length).toBeGreaterThan(0);
        allOutput = (await Promise.all(
            optimizedFiles.map((f) => fs.promises.readFile(f, 'utf-8')),
        )).join('\n');
    }, 30_000);

    afterAll(async () => {
        optimizationConfigLocal.reset();
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });

    it('rule with 0 hits is absent in compiled output', () => {
        expect(allOutput).not.toContain(RULE_TO_FILTER);
    });

    it('rule with 9999 hits is present in compiled output', () => {
        expect(allOutput).toContain(RULE_TO_KEEP);
    });
});
