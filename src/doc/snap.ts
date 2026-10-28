import type { LabelDoc, LabelElement } from './model';

export interface Guide {
  axis: 'x' | 'y';
  /** Position in mm along the other axis' perpendicular. */
  at: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const stops = (start: number, size: number): number[] => [start, start + size / 2, start + size];

/**
 * Snaps a moving box to the label's edges and centre and to other elements'
 * edges and centres. Returns the adjusted position and the guides to draw.
 */
export function snapBox(box: Box, doc: Pick<LabelDoc, 'widthMm' | 'heightMm'>, others: LabelElement[], tolerance: number, extraX: number[] = []) {
  const xTargets = [0, doc.widthMm / 2, doc.widthMm, ...extraX, ...others.flatMap((o) => stops(o.x, o.w))];
  const yTargets = [0, doc.heightMm / 2, doc.heightMm, ...others.flatMap((o) => stops(o.y, o.h))];

  const best = (own: number[], targets: number[]) => {
    let hit: { delta: number; at: number } | null = null;
    for (const p of own) {
      for (const t of targets) {
        const delta = t - p;
        if (Math.abs(delta) <= tolerance && (!hit || Math.abs(delta) < Math.abs(hit.delta))) hit = { delta, at: t };
      }
    }
    return hit;
  };

  const sx = best(stops(box.x, box.w), xTargets);
  const sy = best(stops(box.y, box.h), yTargets);
  const guides: Guide[] = [];
  if (sx) guides.push({ axis: 'x', at: sx.at });
  if (sy) guides.push({ axis: 'y', at: sy.at });
  return { x: box.x + (sx?.delta ?? 0), y: box.y + (sy?.delta ?? 0), guides };
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const rotate = (x: number, y: number, deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};

/**
 * Resizes a (possibly rotated) box by dragging one handle, keeping the
 * opposite edge or corner fixed. dx/dy are the pointer movement in label mm.
 */
export function resizeBox(start: Box & { rotation: number }, handle: Handle, dx: number, dy: number, keepAspect: boolean, min = 0.5): Box {
  const [lx, ly] = rotate(dx, dy, -start.rotation);
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  let w = Math.max(min, start.w + sx * lx);
  let h = Math.max(min, start.h + sy * ly);
  if (keepAspect && sx && sy) {
    const scale = Math.max(w / start.w, h / start.h);
    w = Math.max(min, start.w * scale);
    h = Math.max(min, start.h * scale);
  }
  const [cx, cy] = rotate((sx * (w - start.w)) / 2, (sy * (h - start.h)) / 2, start.rotation);
  const centerX = start.x + start.w / 2 + cx;
  const centerY = start.y + start.h / 2 + cy;
  return { x: centerX - w / 2, y: centerY - h / 2, w, h };
}
