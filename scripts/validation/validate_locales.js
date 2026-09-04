import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateLocales } from '@adguard/filters-compiler';
import { formatDate } from '../utils/strings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR_PATH = '../../locales';
// Follows the report_partial_<date>.txt naming convention; the .gitignore
// entry for it lives in the repo root .gitignore.
const REPORT_FILE_PREFIX = 'report_locales_error_';

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
const removeStaleReports = () => {
    const staleReports = fs.readdirSync(repoRootPath)
        .filter((name) => name.startsWith(REPORT_FILE_PREFIX) && name.endsWith('.md'));
    staleReports.forEach((name) => fs.rmSync(path.join(repoRootPath, name), { force: true }));
};

const localesValidation = validateLocales(localesDirPath, REQUIRED_LOCALES, 'markdown');

removeStaleReports();

if (!localesValidation.ok) {
    const reportPath = path.join(
        repoRootPath,
        `${REPORT_FILE_PREFIX}${formatDate(new Date())}.md`,
    );
    fs.writeFileSync(reportPath, `${localesValidation.log}\n`);
    throw new Error(`Invalid locales messages, see ${path.relative(process.cwd(), reportPath)}`);
}
