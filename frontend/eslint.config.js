// ESLint flat config — Phase 2 static checks (see AGENTS.md §6, ARCHITECTURE.md §7).
//
// Enforces invariants + de-slop rules that prose failed to keep:
//   1. Business dates go through src/utils/datetime.js (Asia/Manila); never
//      call .toISOString() anywhere else.
//   2. Never .replace('_', ' '); use .replace(/_/g, ' ') or .replaceAll('_', ' ').
//   3. No arbitrary type sizes (text-[…px]); use the Scale B tokens.
//   4. No shadow-sm on rounded-float cards (cards are hairline).
//   5. No uppercase micro-label kickers on span/div (table/print headers only).
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
        // --- de-slop guardrails (docs/SLOP_AUDIT.md Phase G) ---
        {
          selector: 'Literal[value=/text-\\[[0-9]+px\\]/]',
          message:
            'No arbitrary type sizes; use the Scale B tokens (text-12/14/16/22/30).',
        },
        {
          selector: 'TemplateElement[value.raw=/text-\\[[0-9]+px\\]/]',
          message:
            'No arbitrary type sizes; use the Scale B tokens (text-12/14/16/22/30).',
        },
        {
          selector: 'Literal[value=/rounded-float/][value=/shadow-sm/]',
          message:
            'Cards are hairline; no shadow-sm on rounded-float (shadow-sm on rounded-ctl is fine).',
        },
        {
          selector: 'TemplateElement[value.raw=/rounded-float/][value.raw=/shadow-sm/]',
          message:
            'Cards are hairline; no shadow-sm on rounded-float (shadow-sm on rounded-ctl is fine).',
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^(span|div)$/] > JSXAttribute[name.name='className'] > Literal[value=/uppercase/]",
          message:
            'No uppercase micro-label kickers on span/div; uppercase is reserved for table headers and print/legal headers.',
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
