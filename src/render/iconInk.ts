/**
 * Where an icon's artwork sits in its 256 × 256 box. Icons leave space
 * around their artwork, which their box should not show. Measured once per
 * icon by the browser; null where it cannot measure (tests, no DOM).
 */
const inks = new Map<string, [number, number, number, number] | null>();
let probe: SVGSVGElement | null = null;

export function iconInk(body: string): [number, number, number, number] | null {
  if (!body) return null;
  if (inks.has(body)) return inks.get(body) ?? null;
  let ink: [number, number, number, number] | null = null;
  try {
    if (!probe) {
      probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      probe.setAttribute('viewBox', '0 0 256 256');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;width:256px;height:256px;left:-9999px;top:0;visibility:hidden';
      document.body.appendChild(probe);
    }
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    // The body is sanitised path data (see sanitizeIconBody).
    g.innerHTML = body;
    probe.appendChild(g);
    const b = typeof g.getBBox === 'function' ? g.getBBox() : null;
    g.remove();
    if (b && b.width > 0 && b.height > 0) {
      const r = (v: number) => Math.round(v * 100) / 100;
      ink = [r(b.x), r(b.y), r(b.width), r(b.height)];
    }
  } catch {
    ink = null;
  }
  inks.set(body, ink);
  return ink;
}

/** For tests: an icon's artwork box, as if measured. */
export function setIconInk(body: string, ink: [number, number, number, number]) {
  inks.set(body, ink);
}
