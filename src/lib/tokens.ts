/**
 * Reading a design token's resolved value (UI Revamp Issue 2).
 *
 * `today.html` paints the radar's stat dots and the ring burst with
 * `getComputedStyle(document.documentElement).getPropertyValue('--stat-str')`,
 * not with a literal, so that each stat's own palette reaches the SVG in both
 * themes. The app does the same; a token resolved here is theme-aware by
 * construction.
 */

export function resolvedToken(token: string): string {
  if (typeof document === 'undefined') {
    return '';
  }

  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
