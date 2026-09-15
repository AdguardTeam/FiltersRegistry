import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    validateLocales,
    type ValidateLocalesResult,
} from '@adguard/filters-compiler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR_PATH = '../../locales';
// Follows the report_partial_*.txt naming convention; the .gitignore entry
// for it lives in the repo root .gitignore. The name is fixed because
// removeStaleReports() below leaves at most one report in the repo root.
const REPORT_FILE_NAME = 'report_locales_error.md';

const REQUIRED_LOCALES = [
    // keep base locale here as well
    'en',
    // + other our locales
    'ru',
    'de',
    'es',
    'fr',
    'it',
    'ja',
    'ko',
    'zh_CN',
    'zh_TW',
    'pt',
    'pt_BR',
    'pt_PT',
];

const repoRootPath = path.join(__dirname, '../..');
const localesDirPath = path.join(__dirname, LOCALES_DIR_PATH);

/**
 * Removes previously generated locale error reports, so that only the latest
 * one (if any) remains in the repo root.
 */
const removeStaleReports = (): void => {
    const staleReports = fs.readdirSync(repoRootPath)
        .filter((name) => name.startsWith('report_locales_error') && name.endsWith('.md'));
    staleReports.forEach((name) => fs.rmSync(path.join(repoRootPath, name), { force: true }));
};

// The `logFormat` argument is added by the counterpart compiler PR
// (https://github.com/AdGuardSoftwareLimited/ext-compiler/pull/20), which is
// merged and released before this PR. This PR bumps @adguard/filters-compiler
// to that release; until the bump lands, the published types lack the argument,
// hence the cast below.
// FIXME: drop the cast after the dependency bump in package.json.
type ValidateLocalesWithFormat = (
    localesDirPath: string,
    requiredLocales: string[],
    logFormat: 'text' | 'markdown',
) => ValidateLocalesResult;

const validateLocalesWithFormat = validateLocales as ValidateLocalesWithFormat;

const localesValidation = validateLocalesWithFormat(localesDirPath, REQUIRED_LOCALES, 'markdown');

removeStaleReports();

if (!localesValidation.ok) {
    const reportPath = path.join(repoRootPath, REPORT_FILE_NAME);
    fs.writeFileSync(reportPath, `${localesValidation.log}\n`);
    throw new Error(`Invalid locales messages, see ${path.relative(process.cwd(), reportPath)}`);
}
