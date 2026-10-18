import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'work/**', 'release/**', 'src-tauri/target/**', 'src-tauri/gen/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/editor/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        'react', 'react/*', 'phaser', '@tauri-apps/*',
        '../app/*', '../ui/*', '../game/*', '../platform/*',
      ] }],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['../app/*', '../../app/*', '../ui/*', '../../ui/*', '../platform/*', '../../platform/*'] }],
    },
  },
  {
    files: ['*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'vite/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
