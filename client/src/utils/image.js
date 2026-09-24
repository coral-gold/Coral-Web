// Shared fallback for any <img> whose src might 404 (missing file, bad
// path, an image still being processed) — swap to a neutral placeholder
// instead of the browser's broken-image icon. `onerror = null` first,
// so a broken placeholder URL itself can never loop.
export const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#FBDCE2"/>
      <text x="100" y="108" font-size="46" text-anchor="middle" font-family="sans-serif">💍</text>
    </svg>
  `.trim());

export function handleImgError(e) {
  e.target.onerror = null;
  e.target.src = PLACEHOLDER_IMG;
}

// A broken custom logo (Admin > Settings) falls back to the default brand
// asset, not the generic product placeholder — a pink swatch would look odd
// standing in for a site logo in the header.
export function handleLogoError(e) {
  e.target.onerror = null;
  e.target.src = '/logo.png';
}
