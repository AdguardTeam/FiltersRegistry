import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'platforms/**',
            'temp/**',
            'dist/**',
        ],
    },
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    importX.flatConfigs.recommended,
    importX.flatConfigs.typescript,
    {
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            'import-x/no-extraneous-dependencies': 'off',
            'import-x/extensions': 'off',
            'import-x/prefer-default-export': 'off',
            'import-x/no-named-as-default': 'off',
            'import-x/no-named-as-default-member': 'off',
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'variable',
                    format: null,
                    filter: {
                        regex: '^(__filename|__dirname)$',
                        match: true,
                    },
                },
            ],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/max-len': [
                'error',
                {
                    code: 120,
                    comments: 120,
                    tabWidth: 4,
                    ignoreUrls: true,
                    ignoreTrailingComments: false,
                    ignoreComments: false,
                },
            ],
            '@stylistic/indent': ['error', 4],
            '@stylistic/no-multi-spaces': [
                'error',
                {
                    ignoreEOLComments: true,
                },
            ],
            'no-useless-escape': 'off',
            'no-param-reassign': 'off',
            'func-names': 'off',
            'no-shadow': 'off',
            'arrow-body-style': 'off',
            'prefer-destructuring': [
                'error',
                {
                    VariableDeclarator: {
                        array: false,
                        object: true,
                    },
                    AssignmentExpression: {
                        array: true,
                        object: false,
                    },
                },
                {
                    enforceForRenamedProperties: false,
                },
            ],
            'consistent-return': 'off',
            'no-prototype-builtins': 'off',
            'dot-notation': 'off',
            'no-continue': 'off',
            'strict': 'off',
            'no-bitwise': 'off',
            'preserve-caught-error': 'off',
            'no-underscore-dangle': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
        },
    },
    {
        files: ['**/*.ts'],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'error',
        },
    },
    {
        files: ['eslint.config.js'],
        extends: [tseslint.configs.disableTypeChecked],
    },
);
