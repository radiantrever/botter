module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module"
  },
  env: {
    node: true,
    es6: true
  },
  extends: [
    "eslint:recommended"
  ],
  rules: {
    "prefer-const": "error",
    "no-console": "warn",
    "no-debugger": "error",
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
};