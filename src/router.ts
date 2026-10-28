import { useEffect, useState } from 'react';

export type Route = 'editor' | 'help' | 'about';

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  return path === 'help' || path === 'about' ? path : 'editor';
}

/** Hash routing, so every page works from a static GitHub Pages path. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
