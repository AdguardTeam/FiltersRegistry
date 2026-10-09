/* eslint-disable no-console */
import path from 'path';
import { fileURLToPath } from 'url';
import { simpleGit, type SimpleGit } from 'simple-git';

export interface CompressOptions {
    commitsToKeep: number;
    cwd?: string;
}

export interface CompressResult {
    oldHead: string;
    newHead: string;
}

const INSTALL_HINT = 'Install it with "brew install git-filter-repo" or "pipx install git-filter-repo".';

/**
 * Checks that `git filter-repo` is available and new enough for the options
 * this script uses.
 *
 * `--version` alone prints a source hash, so it cannot gate the version.
 * `--proceed` exists only from 2.47, which makes it usable as a probe.
 *
 * @param git - Git client bound to the repository being rewritten.
 */
const assertFilterRepoAvailable = async (git: SimpleGit): Promise<void> => {
    try {
        await git.raw(['filter-repo', '--version']);
    } catch {
        throw new Error(`git-filter-repo is not installed. ${INSTALL_HINT}`);
    }

    try {
        await git.raw(['filter-repo', '--proceed', '--version']);
    } catch {
        throw new Error(`git-filter-repo 2.47 or newer is required. ${INSTALL_HINT}`);
    }
};

/**
 * Resolves the boundary commit: the last commit that the rewrite drops.
 *
 * @param git - Git client bound to the repository being rewritten.
 * @param commitsToKeep - Number of first-parent commits to keep.
 * @returns The boundary commit hash.
 */
const resolveBoundary = async (git: SimpleGit, commitsToKeep: number): Promise<string> => {
    try {
        return await git.raw(['rev-parse', `master~${commitsToKeep}`]);
    } catch {
        throw new Error(
            `Cannot find the boundary commit master~${commitsToKeep}: the history is shorter than commitsToKeep.`,
        );
    }
};

/**
 * Validates the rewritten history. Every failure names the failed check and
 * includes the command that restores the old history.
 *
 * @param git - Git client bound to the rewritten repository.
 * @param oldHead - Head hash recorded before the rewrite.
 * @param commitsToKeep - Number of first-parent commits to keep.
 * @param squashMessage - Expected message of the squash commit.
 */
const validateRewrite = async (
    git: SimpleGit,
    oldHead: string,
    commitsToKeep: number,
    squashMessage: string,
): Promise<void> => {
    const recovery = `Restore the old history with: git reset --hard ${oldHead}`;

    const diff = await git.raw(['diff', oldHead, 'master']);
    if (diff !== '') {
        throw new Error(`Tree mismatch after the rewrite: git diff ${oldHead} master is not empty. ${recovery}`);
    }

    const firstParentCount = await git.raw(['rev-list', '--count', '--first-parent', 'master']);
    if (firstParentCount !== String(commitsToKeep + 2)) {
        throw new Error(
            `Unexpected history shape: git rev-list --count --first-parent master is ${firstParentCount}, `
            + `expected ${commitsToKeep + 2}. ${recovery}`,
        );
    }

    const subjects = (await git.raw(['log', '--first-parent', '--reverse', '--format=%s', 'master'])).split('\n');
    if (subjects[1] !== squashMessage) {
        throw new Error(
            `Unexpected history shape: the squash commit is not second in git log --first-parent master. ${recovery}`,
        );
    }

    const replaceRefs = await git.raw(['for-each-ref', 'refs/replace']);
    if (replaceRefs !== '') {
        throw new Error(`Replace refs remain after the rewrite: ${replaceRefs}. ${recovery}`);
    }
};

/**
 * Rewrites `master` into the initial commit, one squash commit, and the last
 * `commitsToKeep` first-parent commits with their merge structure intact.
 *
 * The boundary commit is replaced with a squash commit whose tree equals the
 * boundary tree. `git filter-repo` then bakes the replacement, so no kept
 * commit's parents change and every merge inside the kept range survives.
 *
 * @param options - Compression options.
 * @param options.commitsToKeep - Number of first-parent commits to keep.
 * @param options.cwd - Repository directory; defaults to the process working directory.
 * @returns The head hashes recorded before and after the rewrite.
 */
export const compress = async ({ commitsToKeep, cwd }: CompressOptions): Promise<CompressResult> => {
    if (!Number.isInteger(commitsToKeep) || commitsToKeep < 1) {
        throw new Error('commitsToKeep must be a positive integer');
    }

    const git = simpleGit({ baseDir: cwd, trimmed: true });

    const status = await git.raw(['status', '--porcelain']);
    if (status !== '') {
        throw new Error('The working tree is not clean. Commit or stash the changes before the compression.');
    }

    const boundary = await resolveBoundary(git, commitsToKeep);

    await assertFilterRepoAvailable(git);

    const oldHead = await git.raw(['rev-parse', 'master']);
    const initial = await git.raw(['rev-list', '--max-parents=0', 'master']);
    const tree = await git.raw(['rev-parse', `${boundary}^{tree}`]);
    const squashMessage = `squashed history from ${initial} to ${boundary}`;

    // The squash commit gets the date of the boundary's parent, so it sits
    // chronologically before the kept commits. A dedicated instance keeps the
    // custom environment (which simple-git passes as the whole child
    // environment) away from the commands that need the full process env.
    const boundaryParentDate = await git.raw(['show', '-s', '--format=%cI', `${boundary}~1`]);
    const squash = await simpleGit({ baseDir: cwd, trimmed: true })
        .env({
            ...process.env,
            GIT_AUTHOR_DATE: boundaryParentDate,
            GIT_COMMITTER_DATE: boundaryParentDate,
        })
        .raw(['commit-tree', tree, '-p', initial, '-m', squashMessage]);

    try {
        await git.raw(['replace', boundary, squash]);
        await git.raw(['filter-repo', '--force', '--refs', 'master', '--replace-refs', 'delete-no-add']);
        await validateRewrite(git, oldHead, commitsToKeep, squashMessage);
    } catch (error) {
        try {
            await git.raw(['replace', '-d', boundary]);
        } catch {
            // The replace ref can already be gone after a successful filter-repo run.
        }
        throw error;
    }

    const newHead = await git.raw(['rev-parse', 'master']);
    return { oldHead, newHead };
};

/**
 * Command-line entry point: `yarn compress [commits_to_keep]`.
 */
const runCli = async (): Promise<void> => {
    const argument = process.argv[2] ?? '1000';
    if (!/^\d+$/.test(argument)) {
        console.error('commitsToKeep must be a positive integer');
        process.exit(1);
    }

    try {
        const { oldHead, newHead } = await compress({ commitsToKeep: Number.parseInt(argument, 10) });
        console.log(`Old head: ${oldHead}`);
        console.log(`New head: ${newHead}`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
};

// Run the CLI only when this file is executed directly, not when it is imported.
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    runCli().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    });
}
