// ESLint flat config — Phase 2 static checks (see AGENTS.md §6, ARCHITECTURE.md §7).
//
// Enforces two invariants that prose rules failed to keep:
//   1. Business dates go through src/utils/datetime.js (Asia/Manila); never
//      call .toISOString() anywhere else.
//   2. Never .replace('_', ' '); use .replace(/_/g, ' ') or .replaceAll('_', ' ').
//
// Run: npm run lint
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'src/types/**'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toISOString']",
          message:
            'Do not use toISOString() for business dates; use src/utils/datetime.js (Asia/Manila).',
        },
        {
          selector: "CallExpression[callee.property.name='replace'][arguments.0.value='_']",
          message:
            "Use .replace(/_/g, ' ') or .replaceAll('_', ' '); never .replace('_', ' ').",
        },
      ],
    },
  },
  {
    // The datetime helper is the single place allowed to convert to ISO.
    files: ['src/utils/datetime.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]
