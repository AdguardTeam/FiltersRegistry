import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateLocales } from '@adguard/filters-compiler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR_PATH = '../../locales';
// The report file name is fixed because removeStaleReports() below leaves at
// most one report in the repo root. The file is gitignored (repo root
// .gitignore) and excluded from markdownlint (.markdownlintignore), so a failed
// local validation cannot be committed accidentally or fail the `yarn lint`
// step.
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

// Remove any report left by a previous run BEFORE validating: the compiler
// throws when the locales dir is missing or empty, and a stale report must not
// outlive such an error (report-validation.ts would post it as the current
// failure otherwise).
removeStaleReports();

const localesValidation = validateLocales(localesDirPath, REQUIRED_LOCALES, 'markdown');

if (!localesValidation.ok) {
    const reportPath = path.join(repoRootPath, REPORT_FILE_NAME);
    fs.writeFileSync(reportPath, `${localesValidation.log}\n`);
    throw new Error(`Invalid locales messages, see ${path.relative(process.cwd(), reportPath)}`);
}
