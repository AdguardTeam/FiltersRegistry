/* eslint-disable no-console */
import { realpathSync } from 'fs';
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

interface BoundaryCut {
    grafts: Map<string, string[]>;
    expectedCommitCount: number;
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
 * The `master` branch must exist and hold at least `commitsToKeep` first-parent commits.
 *
 * @param git - Git client bound to the repository being rewritten.
 * @param commitsToKeep - Number of first-parent commits to keep.
 * @returns The boundary commit hash.
 */
const resolveBoundary = async (git: SimpleGit, commitsToKeep: number): Promise<string> => {
    try {
        await git.raw(['rev-parse', '--verify', 'master']);
    } catch {
        throw new Error('The master branch was not found in this repository.');
    }

    try {
        return await git.raw(['rev-parse', `master~${commitsToKeep}`]);
    } catch {
        throw new Error(
            `Cannot find the boundary commit master~${commitsToKeep}: the history is shorter than commitsToKeep.`,
        );
    }
};

/**
 * Collects the grafts that cut the history below the boundary.
 *
 * Replacing the boundary alone is not enough: a branch that forked below the
 * boundary and was merged inside the kept range keeps its own ancestry
 * reachable. Every parent edge that crosses the boundary must point at the
 * squash commit instead.
 *
 * @param git - Git client bound to the repository being rewritten.
 * @param oldHead - Head hash recorded before the rewrite.
 * @param boundary - The last commit that the rewrite drops.
 * @param squash - The squash commit that stands in for the boundary.
 * @returns The commits to graft with the parents they must get, and the number
 *   of commits that must stay reachable from `master`.
 */
const collectBoundaryCut = async (
    git: SimpleGit,
    oldHead: string,
    boundary: string,
    squash: string,
): Promise<BoundaryCut> => {
    const lines = (await git.raw(['rev-list', '--parents', oldHead, `^${boundary}`])).split('\n');
    const kept = new Set(lines.map((line) => line.split(' ')[0]));

    const grafts = lines.reduce((result, line) => {
        const [commit, ...parents] = line.split(' ');
        if (parents.some((parent) => !kept.has(parent))) {
            result.set(commit, parents.map((parent) => (kept.has(parent) ? parent : squash)));
        }
        return result;
    }, new Map<string, string[]>());

    return { grafts, expectedCommitCount: kept.size + 2 };
};

/**
 * Validates the rewritten history. Every failure names the failed check and
 * includes the command that restores the old history.
 *
 * @param git - Git client bound to the rewritten repository.
 * @param oldHead - Head hash recorded before the rewrite.
 * @param commitsToKeep - Number of first-parent commits to keep.
 * @param expectedCommitCount - Number of commits that must stay reachable from `master`.
 * @param squashMessage - Expected message of the squash commit.
 */
const validateRewrite = async (
    git: SimpleGit,
    oldHead: string,
    commitsToKeep: number,
    expectedCommitCount: number,
    squashMessage: string,
): Promise<void> => {
    const recovery = `Restore the old history with: git reset --hard ${oldHead}`;

    const diff = await git.raw(['diff', oldHead, 'master']);
    if (diff !== '') {
        throw new Error(`Tree mismatch after the rewrite: git diff ${oldHead} master is not empty. ${recovery}`);
    }

    const commitCount = await git.raw(['rev-list', '--count', 'master']);
    if (commitCount !== String(expectedCommitCount)) {
        throw new Error(
            `Old history still reachable after the rewrite: git rev-list --count master is ${commitCount}, `
            + `expected ${expectedCommitCount}. ${recovery}`,
        );
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
 * boundary tree, and every parent edge that crosses the boundary is grafted
 * onto that squash commit. `git filter-repo` then bakes the replacements, so
 * the kept commits and their merge structure survive and the dropped commits
 * become unreachable.
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
    const initial = await git.raw(['rev-list', '--max-parents=0', 'master']);

    if (boundary === initial) {
        throw new Error(
            `Cannot use the initial commit as the boundary: commitsToKeep ${commitsToKeep} `
            + 'must leave at least one commit below the boundary.',
        );
    }

    await assertFilterRepoAvailable(git);

    const oldHead = await git.raw(['rev-parse', 'master']);
    const tree = await git.raw(['rev-parse', `${boundary}^{tree}`]);
    const squashMessage = `squashed history from ${initial} to ${boundary}`;

    // The squash commit gets the date of the boundary's parent, so it sits
    // chronologically before the kept commits. The dates go through the process
    // environment: simple-git versions that carry the unsafe-operations plugin
    // refuse a custom environment with variables such as PAGER or EDITOR.
    const boundaryParentDate = await git.raw(['show', '-s', '--format=%cI', `${boundary}~1`]);
    const previousAuthorDate = process.env.GIT_AUTHOR_DATE;
    const previousCommitterDate = process.env.GIT_COMMITTER_DATE;
    process.env.GIT_AUTHOR_DATE = boundaryParentDate;
    process.env.GIT_COMMITTER_DATE = boundaryParentDate;

    let squash: string;
    try {
        squash = await git.raw(['commit-tree', tree, '-p', initial, '-m', squashMessage]);
    } finally {
        if (previousAuthorDate === undefined) {
            delete process.env.GIT_AUTHOR_DATE;
        } else {
            process.env.GIT_AUTHOR_DATE = previousAuthorDate;
        }
        if (previousCommitterDate === undefined) {
            delete process.env.GIT_COMMITTER_DATE;
        } else {
            process.env.GIT_COMMITTER_DATE = previousCommitterDate;
        }
    }

    const { grafts, expectedCommitCount } = await collectBoundaryCut(git, oldHead, boundary, squash);

    try {
        await git.raw(['replace', boundary, squash]);
        await [...grafts].reduce(async (previous, [commit, parents]) => {
            await previous;
            await git.raw(['replace', '--graft', commit, ...parents]);
        }, Promise.resolve());
        await git.raw(['filter-repo', '--force', '--refs', 'master', '--replace-refs', 'delete-no-add']);
        await validateRewrite(git, oldHead, commitsToKeep, expectedCommitCount, squashMessage);
    } catch (error) {
        await [boundary, ...grafts.keys()].reduce(async (previous, commit) => {
            await previous;
            try {
                await git.raw(['replace', '-d', commit]);
            } catch {
                // The replace ref can already be gone after a successful filter-repo run.
            }
        }, Promise.resolve());
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

    const { oldHead, newHead } = await compress({ commitsToKeep: Number.parseInt(argument, 10) });
    console.log(`Old head: ${oldHead}`);
    console.log(`New head: ${newHead}`);
};

// Run the CLI only when this file is executed directly, not when it is imported.
// The real paths are compared, so a symlinked entry point still runs the CLI.
const entryPoint = process.argv[1];
if (entryPoint !== undefined && fileURLToPath(import.meta.url) === realpathSync(entryPoint)) {
    runCli().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    });
}
