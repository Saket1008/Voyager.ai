// Utility functions for consistent text formatting across the app
// Location/title-like fields: capitalize the first letter of each word.

/**
 * Capitalize the first letter of each word in a string.
 * Keeps punctuation and spacing intact.
 */
export function titleCaseLocationText(str = '') {
  return String(str).replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/**
 * For comma/newline separated lists, title-case each segment while preserving delimiters.
 */
export function capitalizeLocationSegments(input = '', delimiter = /([\n,]+)/) {
  const re = delimiter instanceof RegExp ? delimiter : /([\n,]+)/;
  return String(input)
    .split(re)
    .map((seg) => (re.test(seg) ? seg : titleCaseLocationText(seg)))
    .join('');
}
