/**
 * Image proportions, read once per source. Image boxes are drawn and
 * selected at the picture's own proportions, which only the decoded image
 * knows; until it has loaded, the element's own box stands in.
 */
const aspects = new Map<string, number | null>();
const listeners = new Set<() => void>();

/** Width over height of the image at `src`, or null until it has loaded. */
export function imageAspect(src: string): number | null {
  if (!src) return null;
  if (aspects.has(src)) return aspects.get(src) ?? null;
  aspects.set(src, null);
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.onload = () => {
    // SVGs sized only by a viewBox load at 0 × 0; their boxes were sized to their proportions already.
    if (!img.naturalWidth || !img.naturalHeight) return;
    aspects.set(src, img.naturalWidth / img.naturalHeight);
    listeners.forEach((fn) => fn());
  };
  img.src = src;
  return null;
}

/** Hears when another image's proportions become known. */
export function onImageAspect(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** For tests: the proportions of a source, as if it had loaded. */
export function setImageAspect(src: string, aspect: number) {
  aspects.set(src, aspect);
}
