module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    
    // General rules
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'prettier/prettier': 'error',
    
    // Disable conflicting rules
    'no-undef': 'off', // TypeScript handles this
    'no-unused-vars': 'off', // Use @typescript-eslint version
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.config.js',
    '*.config.cjs',
    'jest.config.js',
  ],
};