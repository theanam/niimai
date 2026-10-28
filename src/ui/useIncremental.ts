import { useEffect, useRef, useState } from 'react';

/** Renders a long list a page at a time, adding a page when the sentinel scrolls into view. */
export function useIncremental<T>(items: T[], page: number) {
  const [count, setCount] = useState(page);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setCount(page), [items, page]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setCount((c) => c + page), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [items, page, count]);
  return { visible: items.slice(0, count), more: count < items.length, sentinel, showMore: () => setCount((c) => c + page) };
}
