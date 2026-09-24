import { useEffect, useState } from 'react';
import api from '../api';

// Thin animated bar fixed to the top of the viewport, shown whenever any
// api.* request is in flight. Mounted once at the app root so it applies
// consistently to every screen (public site, wholesaler, admin) without
// each page needing its own loading state.
export default function LoadingBar() {
  const [active, setActive] = useState(0);

  useEffect(() => api.subscribeLoading(setActive), []);

  if (!active) return null;

  return (
    <div className="global-loading-bar" role="status" aria-label="Loading">
      <div className="global-loading-bar-fill" />
    </div>
  );
}
