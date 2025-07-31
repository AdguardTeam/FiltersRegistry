module.exports = {
    'env': {
        'node': true,
    },
    'extends': [
        'airbnb-base',
        'airbnb-typescript/base',
    ],
    'parserOptions': {
        'project': './tsconfig.json',
    },
    'rules': {
        'import/no-extraneous-dependencies': 0,
        'max-len': [
            'error',
            {
                'code': 120,
                'comments': 120,
                'tabWidth': 4,
                'ignoreUrls': true,
                'ignoreTrailingComments': false,
                'ignoreComments': false,
            },
        ],
        'indent': 'off',
        '@typescript-eslint/indent': [
            'error',
            4,
        ],
        'no-useless-escape': 'off',
        'no-param-reassign': 'off',
        'wrap-iife': 'off',
        'func-names': 'off',
        'no-shadow': 'off',
        'arrow-body-style': 0,
        'no-multi-spaces': [
            'error',
            {
                'ignoreEOLComments': true,
            },
        ],
        // Prefer destructuring from arrays and objects
        // https://eslint.org/docs/rules/prefer-destructuring
        'prefer-destructuring': [
            'error',
            {
                'VariableDeclarator': {
                    'array': false,
                    'object': true,
                },
                'AssignmentExpression': {
                    'array': true,
                    'object': false,
                },
            },
            {
                'enforceForRenamedProperties': false,
            },
        ],
        'consistent-return': 'off',
        'no-prototype-builtins': 'off',
        'dot-notation': 'off',
        'quote-props': 'off',
        'no-continue': 'off',
        'strict': 'off',
        'no-bitwise': 'off',
        'no-underscore-dangle': 'off',
        'import/prefer-default-export': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'error',
    },
    'overrides': [
        {
            // enable the rule specifically for TypeScript files
            'files': [
                '*.ts',
            ],
            'rules': {
                '@typescript-eslint/explicit-function-return-type': 'error',
            },
        },
    ],
};
