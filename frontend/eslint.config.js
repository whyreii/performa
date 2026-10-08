// ESLint flat config — Phase 2 static checks (see AGENTS.md §6, ARCHITECTURE.md §7).
//
// Enforces invariants + de-slop rules that prose failed to keep:
//   1. Business dates go through src/utils/datetime.js (Asia/Manila); never
//      call .toISOString() anywhere else.
//   2. Never .replace('_', ' '); use .replace(/_/g, ' ') or .replaceAll('_', ' ').
//   3. No arbitrary type sizes (text-[…px]); use the Scale B tokens.
//   3b. No off-scale Tailwind default sizes (text-lg/xl/2xl/3xl/4xl/5xl/6xl);
//       Scale B is exactly 12/14/16/22/30.
//   4. No shadow-sm on rounded-float cards (cards are hairline).
//   5. No uppercase micro-label kickers on span/div (table/print headers only).
//   6. Icons come from src/components/icons.js only (no direct icon-library imports).
//
// Run: npm run lint
import jsxA11y from 'eslint-plugin-jsx-a11y';

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
          selector: 'Literal[value=/text-(lg|xl|2xl|3xl|4xl|5xl|6xl)\\b/]',
          message:
            'Off-scale type size; Scale B is exactly text-12/14/16/22/30 (no 18px/20px/24px/36px+).',
        },
        {
          selector: 'TemplateElement[value.raw=/text-(lg|xl|2xl|3xl|4xl|5xl|6xl)\\b/]',
          message:
            'Off-scale type size; Scale B is exactly text-12/14/16/22/30 (no 18px/20px/24px/36px+).',
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
        // --- surface guardrail (docs/UIUX_STANDARDS.md §6) ---
        {
          selector: 'Literal[value=/bg-surface border border-line rounded-float/]',
          message:
            'Do not hand-roll the card surface; use <Card>/<Surface> from src/components/ui.',
        },
        {
          selector: 'TemplateElement[value.raw=/bg-surface border border-line rounded-float/]',
          message:
            'Do not hand-roll the card surface; use <Card>/<Surface> from src/components/ui.',
        },
        // --- Vercel Web Interface Guidelines deltas (docs/UIUX_STANDARDS.md App. D) ---
        {
          selector: 'Literal[value=/transition-all/]',
          message:
            'Never `transition: all`; list properties explicitly (transition-colors/-transform/-opacity or a named `transition`). See docs/UIUX_STANDARDS.md Appendix D.',
        },
        {
          selector: 'TemplateElement[value.raw=/transition-all/]',
          message:
            'Never `transition: all`; list properties explicitly (transition-colors/-transform/-opacity or a named `transition`). See docs/UIUX_STANDARDS.md Appendix D.',
        },
        {
          selector: 'Literal[value=/[A-Za-z0-9]\\.\\.\\./]',
          message:
            "Use the ellipsis character '…', not three dots, in user-facing copy/placeholders. See docs/UIUX_STANDARDS.md Appendix D.",
        },
        {
          selector: 'TemplateElement[value.raw=/[A-Za-z0-9]\\.\\.\\./]',
          message:
            "Use the ellipsis character '…', not three dots, in user-facing copy/placeholders. See docs/UIUX_STANDARDS.md Appendix D.",
        },
      ],
      // --- icon guardrail (docs/SLOP_AUDIT.md) ---
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react',
              message: 'Icons are centralized in src/components/icons.js.',
            },
            {
              name: '@phosphor-icons/react',
              message: 'Icons are centralized in src/components/icons.js.',
            },
          ],
        },
      ],
    },
  },
  {
    // The datetime helper is the single place allowed to convert to ISO.
    files: ['src/utils/datetime.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // The icon module is the single place allowed to import an icon library.
    files: ['src/components/icons.js'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // The surface definition lives in the primitives; the modal panel is its own
    // surface (rounded-float + shadow-pop), so it is allowed to spell it out.
    files: ['src/components/ui/Modal.jsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Accessibility (POUR R-1): the recommended jsx-a11y ruleset, scoped to source.
    files: ['src/**/*.{js,jsx}'],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Labels that wrap a control and put their text in a nested block (e.g. a
      // status radio with a title + description) need a deeper text search.
      'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }],
    },
  },
]
