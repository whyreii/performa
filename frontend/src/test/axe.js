import axe from 'axe-core';

// Runtime accessibility check for a rendered container. Returns a list of
// violations (empty means clean). color-contrast is disabled because jsdom has
// no layout/paint; contrast is covered by the documented palette measurements.
export async function axeViolations(container) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
