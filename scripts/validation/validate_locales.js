import path from 'path';
import { fileURLToPath } from 'url';
import { validateLocales } from '@adguard/filters-compiler';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const LOCALES_DIR_PATH = '../../locales';

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

const localesDirPath = path.join(dirname, LOCALES_DIR_PATH);
const localesValidation = validateLocales(localesDirPath, REQUIRED_LOCALES);

if (!localesValidation.ok) {
    throw new Error('Invalid locales messages');
}
