import {
    describe, it, expect, afterEach,
} from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { simpleGit, type SimpleGit } from 'simple-git';
import { compress } from '../compress.js';

const COMMITS_TO_KEEP = 5;
const MERGE_SUBJECT = 'Merge feature';

interface FixtureCommit {
    subject: string;
    date: string;
}

const LINEAR_COMMITS: FixtureCommit[] = [
    { subject: 'Initial commit', date: '2024-01-01T00:00:00+00:00' },
    { subject: 'Second commit', date: '2024-01-02T00:00:00+00:00' },
    { subject: 'Third commit', date: '2024-01-03T00:00:00+00:00' },
    { subject: 'Fourth commit', date: '2024-01-04T00:00:00+00:00' },
];

const FEATURE_COMMIT: FixtureCommit = {
    subject: 'Feature commit',
    date: '2024-01-05T00:00:00+00:00',
};

const MERGE_DATE = '2024-01-06T00:00:00+00:00';

const TAIL_COMMITS: FixtureCommit[] = [
    { subject: 'Fifth commit', date: '2024-01-07T00:00:00+00:00' },
    { subject: 'Sixth commit', date: '2024-01-08T00:00:00+00:00' },
    { subject: 'Seventh commit', date: '2024-01-09T00:00:00+00:00' },
    { subject: 'Eighth commit', date: '2024-01-10T00:00:00+00:00' },
];

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testsDir, '..', '..', '..');
const compressModulePath = path.join(projectRoot, 'scripts', 'repository', 'compress.ts');
const tsxBinaryPath = path.join(projectRoot, 'node_modules', '.bin', 'tsx');

interface TestRepository {
    dir: string;
    commitsToKeep: number;
    oldHead: string;
    boundary: string;
    initial: string;
    squashMessage: string;
    keptSubjects: string[];
    keptCommitterDates: string[];
    mergeSubject: string;
}

const testDirs: string[] = [];

afterEach(async () => {
    await Promise.all(testDirs.splice(0).map(async (dir) => fs.rm(dir, { recursive: true, force: true })));
});

/**
 * Creates a temporary directory tracked for removal in `afterEach`.
 *
 * @param prefix - Prefix for the temporary directory name.
 * @returns The created directory path.
 */
const makeTempDir = async (prefix: string): Promise<string> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    testDirs.push(dir);
    return dir;
};

/**
 * Writes `content` to `file.txt` and commits it with a fixed committer date.
 *
 * @param git - Git client bound to the fixture repository.
 * @param dir - Fixture repository directory.
 * @param content - Content of `file.txt` for this commit.
 * @param subject - Commit subject.
 * @param date - Author and committer date for the commit.
 */
const writeAndCommit = async (
    git: SimpleGit,
    dir: string,
    content: string,
    subject: string,
    date: string,
): Promise<void> => {
    await fs.writeFile(path.join(dir, 'file.txt'), content, 'utf8');
    const commitGit = git.env('GIT_AUTHOR_DATE', date).env('GIT_COMMITTER_DATE', date);
    await commitGit.add('file.txt');
    await commitGit.commit(subject);
};

/**
 * Commits a sequence of fixture commits one after another.
 *
 * @param git - Git client bound to the fixture repository.
 * @param dir - Fixture repository directory.
 * @param commits - Commits to create, oldest first.
 * @param contentPrefix - Prefix for the unique `file.txt` content of each commit.
 */
const commitSequence = async (
    git: SimpleGit,
    dir: string,
    commits: FixtureCommit[],
    contentPrefix: string,
): Promise<void> => {
    await commits.reduce(async (previous, commit, index) => {
        await previous;
        await writeAndCommit(git, dir, `${contentPrefix} ${index + 1}`, commit.subject, commit.date);
    }, Promise.resolve());
};

/**
 * Builds a temporary Git repository with a linear part, a merge commit, and
 * enough first-parent commits to cover the boundary.
 *
 * The first-parent chain, oldest to newest: Initial commit, Second commit,
 * Third commit, Fourth commit, Merge feature, Fifth commit..Eighth commit.
 * The feature branch starts at Fourth commit and is merged with `--no-ff`.
 *
 * @returns The fixture directory and the recorded history details.
 */
const createTestRepository = async (): Promise<TestRepository> => {
    const dir = await makeTempDir('compress-test-');
    const git = simpleGit({ baseDir: dir, trimmed: true });

    await git.raw(['init', '--initial-branch=master']);
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    await git.addConfig('commit.gpgsign', 'false');

    await commitSequence(git, dir, LINEAR_COMMITS, 'linear content');

    const boundary = await git.revparse('master');

    await git.checkoutLocalBranch('feature');
    await writeAndCommit(git, dir, 'feature content', FEATURE_COMMIT.subject, FEATURE_COMMIT.date);
    await git.checkout('master');

    const mergeGit = git.env('GIT_AUTHOR_DATE', MERGE_DATE).env('GIT_COMMITTER_DATE', MERGE_DATE);
    await mergeGit.raw(['merge', '--no-ff', '-m', MERGE_SUBJECT, 'feature']);
    await git.raw(['branch', '-d', 'feature']);

    await commitSequence(git, dir, TAIL_COMMITS, 'tail content');

    const oldHead = await git.revparse('master');
    const initial = await git.raw(['rev-list', '--max-parents=0', 'master']);
    const keptSubjects = [MERGE_SUBJECT, ...TAIL_COMMITS.map((commit) => commit.subject)];
    const keptCommitterDates = (await git.raw(['log', '--first-parent', '--format=%cI', 'master']))
        .split('\n')
        .slice(0, COMMITS_TO_KEEP);

    return {
        dir,
        commitsToKeep: COMMITS_TO_KEEP,
        oldHead,
        boundary,
        initial,
        squashMessage: `squashed history from ${initial} to ${boundary}`,
        keptSubjects,
        keptCommitterDates,
        mergeSubject: MERGE_SUBJECT,
    };
};

// The rewrite tests drive the real `git filter-repo`, which CI runners do not
// install; skip them when the tool is missing.
const filterRepoAvailable = spawnSync('git', ['filter-repo', '--proceed', '--version'], { stdio: 'ignore' })
    .status === 0;

describe('compress', () => {
    it.skipIf(!filterRepoAvailable)(
        'rewrites the history into the initial commit, one squash commit, and the last commits',
        async () => {
            const repo = await createTestRepository();
            const git = simpleGit({ baseDir: repo.dir, trimmed: true });

            const result = await compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir });

            expect(result.oldHead).toBe(repo.oldHead);
            expect(result.newHead).toBe(await git.revparse('master'));

            const count = await git.raw(['rev-list', '--count', '--first-parent', 'master']);
            expect(count).toBe(String(repo.commitsToKeep + 2));

            const subjects = (await git.raw(['log', '--first-parent', '--reverse', '--format=%s', 'master']))
                .split('\n');
            expect(subjects).toEqual(['Initial commit', repo.squashMessage, ...repo.keptSubjects]);
        },
    );

    it.skipIf(!filterRepoAvailable)('keeps the tree of the old head unchanged', async () => {
        const repo = await createTestRepository();
        const git = simpleGit({ baseDir: repo.dir, trimmed: true });

        await compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir });

        expect(await git.raw(['diff', repo.oldHead, 'master'])).toBe('');
    });

    it.skipIf(!filterRepoAvailable)('keeps the merge commit inside the last commits', async () => {
        const repo = await createTestRepository();
        const git = simpleGit({ baseDir: repo.dir, trimmed: true });

        await compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir });

        expect(await git.raw(['rev-list', '--count', '--merges', 'master'])).toBe('1');

        const subjects = (await git.raw(['log', '--first-parent', '--format=%s', 'master'])).split('\n');
        expect(subjects).toContain(repo.mergeSubject);
    });

    it.skipIf(!filterRepoAvailable)('keeps the committer dates of the last commits', async () => {
        const repo = await createTestRepository();
        const git = simpleGit({ baseDir: repo.dir, trimmed: true });

        await compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir });

        const dates = (await git.raw(['log', '--first-parent', '--format=%cI', 'master']))
            .split('\n')
            .slice(0, repo.commitsToKeep);
        expect(dates).toEqual(repo.keptCommitterDates);
    });

    it.skipIf(!filterRepoAvailable)('removes the replace refs', async () => {
        const repo = await createTestRepository();
        const git = simpleGit({ baseDir: repo.dir, trimmed: true });

        await compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir });

        expect(await git.raw(['for-each-ref', 'refs/replace'])).toBe('');
    });

    it.skipIf(!filterRepoAvailable)('keeps other branches and the origin remote', async () => {
        const repo = await createTestRepository();
        const git = simpleGit({ baseDir: repo.dir, trimmed: true });
        const originUrl = 'https://github.com/example/example.git';

        await git.raw(['branch', 'second', repo.initial]);
        await git.raw(['remote', 'add', 'origin', originUrl]);

        await compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir });

        expect(await git.revparse('second')).toBe(repo.initial);
        expect(await git.raw(['remote', 'get-url', 'origin'])).toBe(originUrl);
    });

    it('rejects a dirty working tree', async () => {
        const repo = await createTestRepository();
        const git = simpleGit({ baseDir: repo.dir, trimmed: true });
        await fs.writeFile(path.join(repo.dir, 'file.txt'), 'dirty content', 'utf8');

        await expect(compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir }))
            .rejects.toThrow(/working tree/i);

        expect(await git.revparse('master')).toBe(repo.oldHead);
    });

    it('rejects an invalid commitsToKeep', async () => {
        const repo = await createTestRepository();
        const git = simpleGit({ baseDir: repo.dir, trimmed: true });

        await Promise.all([0, -1, 1.5, Number.NaN].map(async (commitsToKeep) => {
            await expect(compress({ commitsToKeep, cwd: repo.dir }))
                .rejects.toThrow(/commitsToKeep/);
        }));

        expect(await git.revparse('master')).toBe(repo.oldHead);
    });

    it('rejects a commitsToKeep larger than the history', async () => {
        const repo = await createTestRepository();
        const git = simpleGit({ baseDir: repo.dir, trimmed: true });

        await expect(compress({ commitsToKeep: 1000, cwd: repo.dir }))
            .rejects.toThrow(/boundary/i);

        expect(await git.revparse('master')).toBe(repo.oldHead);
    });

    it('rejects a missing git-filter-repo', async () => {
        const repo = await createTestRepository();
        const binDir = await makeTempDir('compress-bin-');
        const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
        await fs.symlink(realGit, path.join(binDir, 'git'));

        const originalPath = process.env.PATH;
        process.env.PATH = binDir;
        try {
            const error = await compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir })
                .then(() => null, (reason: unknown) => reason);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('git-filter-repo is not installed');
            expect((error as Error).message).toContain('brew install git-filter-repo');
        } finally {
            process.env.PATH = originalPath;
        }
    });

    it.skipIf(!filterRepoAvailable)('restores the old history after a failed validation', async () => {
        const repo = await createTestRepository();
        const binDir = await makeTempDir('compress-tamper-');
        const realFilterRepo = execFileSync('which', ['git-filter-repo'], { encoding: 'utf8' }).trim();

        const wrapper = [
            '#!/bin/bash',
            `REAL='${realFilterRepo}'`,
            'case " $* " in',
            '    *" --version "*) exec "$REAL" "$@" ;;',
            'esac',
            '"$REAL" "$@"',
            'status=$?',
            'if [ "$status" -ne 0 ]; then exit "$status"; fi',
            'echo tampered >> file.txt',
            'git add file.txt',
            'git commit -q -m "tamper tree"',
            '',
        ].join('\n');
        await fs.writeFile(path.join(binDir, 'git-filter-repo'), wrapper, { mode: 0o755 });

        const originalPath = process.env.PATH;
        process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;
        try {
            await expect(compress({ commitsToKeep: repo.commitsToKeep, cwd: repo.dir }))
                .rejects.toThrow(/tree mismatch/i);
        } finally {
            process.env.PATH = originalPath;
        }

        const git = simpleGit({ baseDir: repo.dir, trimmed: true });
        await git.raw(['reset', '--hard', repo.oldHead]);

        expect(await git.revparse('master')).toBe(repo.oldHead);
        expect(await fs.readFile(path.join(repo.dir, 'file.txt'), 'utf8')).toBe('tail content 4');
    });

    it('does not run the CLI when the module is imported', async () => {
        const dir = await makeTempDir('compress-import-');
        const entryPath = path.join(dir, 'entry.ts');
        await fs.writeFile(entryPath, `import ${JSON.stringify(compressModulePath)};\n`, 'utf8');

        const result = spawnSync(tsxBinaryPath, [entryPath], { cwd: dir, encoding: 'utf8' });

        expect(result.status).toBe(0);
    });

    it('exits with code 1 when commitsToKeep is invalid', async () => {
        const repo = await createTestRepository();

        const result = spawnSync(tsxBinaryPath, [compressModulePath, '0'], { cwd: repo.dir, encoding: 'utf8' });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('commitsToKeep must be a positive integer');
    });

    it.skipIf(!filterRepoAvailable)('prints the old head and the new head', async () => {
        const repo = await createTestRepository();

        const result = spawnSync(tsxBinaryPath, [compressModulePath, String(repo.commitsToKeep)], {
            cwd: repo.dir,
            encoding: 'utf8',
        });

        expect(result.status).toBe(0);

        const git = simpleGit({ baseDir: repo.dir, trimmed: true });
        expect(result.stdout).toContain(repo.oldHead);
        expect(result.stdout).toContain(await git.revparse('master'));
    });
});
