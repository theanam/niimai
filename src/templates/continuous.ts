/**
 * Templates for continuous paper (ESC/POS and cat printers): 48 mm wide, as
 * long as they need to be. Lists, planners and notes that only make sense on
 * a roll without gaps, so the library shows them only when such a printer is
 * connected.
 */
import { createElement, DEFAULT_FONT, type LabelElement, type LabelSize } from '../doc/model';
import type { Template } from '.';

export const CONTINUOUS_CATEGORY = { id: 'continuous', name: 'Continuous paper' };

const W = 48;
const M = 3;
const INNER = W - 2 * M;
const ROW = 6.5;
const size = (heightMm: number): LabelSize => ({ widthMm: W, heightMm });

const text = (value: string, x: number, y: number, w: number, h: number, opts: { bold?: boolean; pt?: number; align?: 'left' | 'center' | 'right' } = {}): LabelElement =>
  ({
    ...createElement('text', size(1)),
    x,
    y,
    w,
    h,
    text: value,
    fontFamily: DEFAULT_FONT,
    bold: opts.bold ?? false,
    align: opts.align ?? 'left',
    autoFit: !opts.pt,
    fontSize: opts.pt ?? 12,
  }) as LabelElement;

const rule = (y: number, x = M, w = INNER, stroke = 0.2): LabelElement =>
  ({ ...createElement('line', size(1)), x, y: y - 0.5, w, h: 1, direction: 'horizontal', strokeWidth: stroke }) as LabelElement;

const box = (x: number, y: number, s = 3.6): LabelElement =>
  ({ ...createElement('rect', size(1)), x, y, w: s, h: s, strokeWidth: 0.3, fill: false, radius: 0.5 }) as LabelElement;

/** A bold title with a heavier rule under it. Returns the elements and where the body starts. */
const header = (title: string, sub?: string): [LabelElement[], number] => {
  const els = [text(title, M, 3, INNER, 7, { bold: true })];
  let y = 11.5;
  if (sub) {
    els.push(text(sub, M, y - 1, INNER, 3.5, { pt: 8 }));
    y += 4;
  }
  els.push(rule(y, M, INNER, 0.5));
  return [els, y + 2];
};

/** Checkbox rows, with optional labels already written in. */
const checklist = (y: number, count: number, labels: string[] = []): LabelElement[] =>
  Array.from({ length: count }, (_, i) => {
    const top = y + i * ROW;
    const label = labels[i];
    return [box(M, top + 0.8), rule(top + 5, M + 5.5, INNER - 5.5), ...(label ? [text(label, M + 5.5, top + 0.6, INNER - 5.5, 4, { pt: 9 })] : [])];
  }).flat();

/** Plain writing lines. */
const lines = (y: number, count: number, gap = ROW): LabelElement[] => Array.from({ length: count }, (_, i) => rule(y + (i + 1) * gap - 1));

/** A small caption with writing space after it on the same line. */
const field = (label: string, y: number): LabelElement[] => [text(label, M, y, 14, 4, { pt: 8 }), rule(y + 4, M + 14, INNER - 14)];

/** A section heading inside a template. */
const section = (title: string, y: number): LabelElement => text(title, M, y, INNER, 4.5, { bold: true, pt: 10 });

interface Spec {
  id: string;
  name: string;
  /** Extra words people might search for. */
  keywords: string;
  heightMm: number;
  build: () => LabelElement[];
}

const SPECS: Spec[] = [
  {
    id: 'todo',
    name: 'To-do list',
    keywords: 'tasks checklist todo',
    heightMm: 80,
    build: () => {
      const [h, y] = header('To do', 'Date ____________');
      return [...h, ...checklist(y, 9)];
    },
  },
  {
    id: 'shopping',
    name: 'Shopping list',
    keywords: 'groceries market',
    heightMm: 90,
    build: () => {
      const [h, y] = header('Shopping');
      return [...h, ...checklist(y, 11)];
    },
  },
  {
    id: 'packing',
    name: 'Packing list',
    keywords: 'travel trip suitcase',
    heightMm: 95,
    build: () => {
      const [h, y] = header('Packing');
      return [...h, ...checklist(y, 12, ['Passport', 'Phone charger', 'Toothbrush', 'Medicine', 'Clothes', 'Shoes', 'Headphones', 'Wallet & keys'])];
    },
  },
  {
    id: 'day',
    name: 'Daily plan',
    keywords: 'schedule planner agenda day',
    heightMm: 85,
    build: () => {
      const [h, y] = header('Today', 'Date ____________');
      const slots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      const els = slots.flatMap((t, i) => {
        const top = y + i * 9;
        return [text(t, M, top + 0.6, 10, 4, { pt: 8, bold: true }), rule(top + 4.5, M + 11, INNER - 11), rule(top + 8.5, M + 11, INNER - 11)];
      });
      return [...h, ...els];
    },
  },
  {
    id: 'notes',
    name: 'Notes',
    keywords: 'memo lined',
    heightMm: 60,
    build: () => {
      const [h, y] = header('Notes');
      return [...h, ...lines(y, 7)];
    },
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    keywords: 'minutes actions work',
    heightMm: 95,
    build: () => {
      const [h, y] = header('Meeting');
      const els = [...field('Date', y), ...field('With', y + 6), section('Notes', y + 13), ...lines(y + 17, 4), section('Actions', y + 44)];
      return [...h, ...els, ...checklist(y + 49, 4)];
    },
  },
  {
    id: 'recipe',
    name: 'Recipe',
    keywords: 'cooking ingredients kitchen',
    heightMm: 100,
    build: () => {
      const [h, y] = header('Recipe');
      const els = [...field('Name', y), ...field('Serves', y + 6), section('Ingredients', y + 13), ...checklist(y + 18, 5), section('Steps', y + 52), ...lines(y + 56, 4)];
      return [...h, ...els];
    },
  },
  {
    id: 'habits',
    name: 'Habit tracker',
    keywords: 'week routine tracker',
    heightMm: 60,
    build: () => {
      const [h, y] = header('Habits', 'Week of ____________');
      const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const cell = 4.2;
      const gridX = W - M - days.length * cell;
      const heads = days.map((d, i) => text(d, gridX + i * cell, y, cell, 3.5, { pt: 8, bold: true, align: 'center' }));
      const rows = Array.from({ length: 5 }, (_, r) => {
        const top = y + 5 + r * 7;
        return [rule(top + 4, M, gridX - M - 1.5), ...days.map((_, i) => box(gridX + i * cell + 0.5, top + 0.6, 3.2))];
      }).flat();
      return [...h, ...heads, ...rows];
    },
  },
  {
    id: 'message',
    name: 'Phone message',
    keywords: 'while you were out call office',
    heightMm: 70,
    build: () => {
      const [h, y] = header('While you were out');
      return [...h, ...field('For', y), ...field('From', y + 6), ...field('Phone', y + 12), ...field('Time', y + 18), section('Message', y + 25), ...lines(y + 29, 3)];
    },
  },
  {
    id: 'workout',
    name: 'Workout',
    keywords: 'gym exercise sets fitness',
    heightMm: 85,
    build: () => {
      const [h, y] = header('Workout', 'Date ____________');
      const sets = 4;
      const cell = 5;
      const gridX = W - M - sets * cell;
      const rows = Array.from({ length: 7 }, (_, r) => {
        const top = y + r * 8;
        return [rule(top + 5, M, gridX - M - 1.5), ...Array.from({ length: sets }, (_, i) => box(gridX + i * cell + 0.5, top + 0.8, 4))];
      }).flat();
      return [...h, ...rows];
    },
  },
];

/** Every continuous-paper template, ready for the library. */
export const CONTINUOUS_TEMPLATES: Template[] = SPECS.map((s) => ({
  id: `continuous-${s.id}`,
  name: s.name,
  variant: 'text',
  category: CONTINUOUS_CATEGORY.id,
  size: size(s.heightMm),
  haystack: `${s.name} ${CONTINUOUS_CATEGORY.name} ${s.keywords}`.toLowerCase(),
  kind: { id: `continuous-${s.id}`, category: CONTINUOUS_CATEGORY.id, name: s.name, title: s.name },
  build: s.build,
}));
