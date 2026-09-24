import React, { useState, useEffect } from 'react';

// Product photo for catalog-style cards. Renders the existing placeholder
// div (same CSS classes/icon already used everywhere) both when there's no
// image on record AND when the src fails to actually load (missing file,
// bad path, an upload still processing) — never the browser's broken-image
// icon, and never a raw console error either.
export default function CatalogImage({ src, alt, imgClassName, placeholderClassName, icon = '💍', onClick, loading }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [src]);

  if (!src || errored) {
    return <div className={placeholderClassName}>{icon}</div>;
  }
  return (
    <img
      src={src} alt={alt} className={imgClassName} loading={loading}
      onClick={onClick} onError={() => setErrored(true)}
      style={onClick ? { cursor: 'zoom-in' } : undefined}
    />
  );
}
