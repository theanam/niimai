import { coverBox, unionBox, type Box } from './bounds';
import type { LabelElement } from './model';

export type AlignTo = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export type Axis = 'x' | 'y';

type Patches = Record<string, { x?: number; y?: number }>;

const tidy = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Moves each element so the edge or centre of what it draws lines up: with
 * each other when there are several, with `area` (the label) when there is
 * one. Elements are measured by what they visibly cover, rotation included.
 */
export function alignPatches(els: LabelElement[], to: AlignTo, area: Box): Patches {
  const boxes = els.map((el) => coverBox(el));
  const target = els.length > 1 ? unionBox(boxes) : area;
  const patches: Patches = {};
  els.forEach((el, i) => {
    const b = boxes[i];
    const dx = to === 'left' ? target.x - b.x : to === 'right' ? target.x + target.w - b.x - b.w : to === 'centerX' ? target.x + target.w / 2 - b.x - b.w / 2 : 0;
    const dy = to === 'top' ? target.y - b.y : to === 'bottom' ? target.y + target.h - b.y - b.h : to === 'centerY' ? target.y + target.h / 2 - b.y - b.h / 2 : 0;
    if (Math.abs(dx) > 0.0005) patches[el.id] = { ...patches[el.id], x: tidy(el.x + dx) };
    if (Math.abs(dy) > 0.0005) patches[el.id] = { ...patches[el.id], y: tidy(el.y + dy) };
  });
  return patches;
}

/**
 * Spaces three or more elements evenly along an axis: the outermost stay,
 * and the gaps between neighbours become equal.
 */
export function distributePatches(els: LabelElement[], axis: Axis): Patches {
  if (els.length < 3) return {};
  const pos = axis === 'x' ? 'x' : 'y';
  const size = axis === 'x' ? 'w' : 'h';
  const items = els.map((el) => ({ el, b: coverBox(el) })).sort((a, b) => a.b[pos] + a.b[size] / 2 - (b.b[pos] + b.b[size] / 2));
  const first = items[0].b;
  const last = items[items.length - 1].b;
  const span = last[pos] + last[size] - first[pos];
  const gap = (span - items.reduce((sum, { b }) => sum + b[size], 0)) / (items.length - 1);
  const patches: Patches = {};
  let at = first[pos];
  for (const { el, b } of items) {
    const d = at - b[pos];
    if (Math.abs(d) > 0.0005) patches[el.id] = { [pos]: tidy(el[pos] + d) };
    at += b[size] + gap;
  }
  return patches;
}
