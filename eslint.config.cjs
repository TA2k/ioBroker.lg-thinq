const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [...compat.extends("eslint:recommended"), {
    plugins: {},

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.mocha,
        },

        ecmaVersion: 2018,
        sourceType: "commonjs",
    },

    rules: {
        indent: ["error", 4, {
            SwitchCase: 1,
        }],

        "no-console": "off",
        "no-var": "error",
        "no-trailing-spaces": "error",
        "prefer-const": "error",

        quotes: ["error", "double", {
            avoidEscape: true,
            allowTemplateLiterals: true,
        }],

        semi: ["error", "always"],
    },
}];