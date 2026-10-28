import { createElement, type Align, type LabelElement, type LabelSize, type TextElement } from '../doc/model';
import { clamp, round1 } from '../lib/units';

export type TemplateStyle = 'plain' | 'border' | 'round' | 'divider' | 'warning';

export interface TemplateCode {
  type: 'qr' | 'code128' | 'ean13';
  value: string;
}

/** What a template says. The layout engine decides where it goes for each label size. */
export interface TemplateContent {
  /** Small text above the title, e.g. "HELLO my name is". */
  pre?: string;
  title: string;
  lines?: string[];
  code?: TemplateCode;
  /** An icon to lead with: its Phosphor name and path markup. */
  icon?: { name: string; body: string };
  style: TemplateStyle;
  font: string;
  bodyFont: string;
  /** Families without a bold face draw the title at regular weight. */
  titleBold: boolean;
  align?: Align;
  upper?: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Text keeps a little air at its sides, so auto-fit never runs it into a border or code. */
const text = (box: Box, value: string, font: string, bold: boolean, align: Align): TextElement => ({
  ...(createElement('text', { widthMm: 1, heightMm: 1 }) as TextElement),
  x: round1(box.x + box.w * 0.03),
  y: round1(box.y),
  w: round1(box.w * 0.94),
  h: round1(box.h),
  text: value,
  fontFamily: font,
  bold,
  align,
  autoFit: true,
});

const size = { widthMm: 1, heightMm: 1 };
const place = <T extends LabelElement>(el: T, box: Box): T => ({ ...el, x: round1(box.x), y: round1(box.y), w: round1(box.w), h: round1(box.h) });

/**
 * Lays template content out on a label of the given size. Wide strips put
 * codes beside the text and keep at most one detail line; taller labels stack
 * text and put barcodes underneath.
 */
export function layoutTemplate(c: TemplateContent, { widthMm: W, heightMm: H }: LabelSize): LabelElement[] {
  const out: LabelElement[] = [];
  const m = clamp(Math.min(W, H) * 0.1, 1, 3);
  let box: Box = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };

  if (c.style === 'border' || c.style === 'round' || c.style === 'warning') {
    const stroke = c.style === 'warning' ? clamp(Math.min(W, H) * 0.06, 0.6, 1.4) : 0.4;
    const inset = m * 0.5;
    out.push(
      place({ ...createElement('rect', size), strokeWidth: stroke, fill: false, radius: c.style === 'round' ? round1(Math.min(W, H) * 0.18) : c.style === 'warning' ? 0.6 : 1 } as LabelElement, {
        x: inset,
        y: inset,
        w: W - 2 * inset,
        h: H - 2 * inset,
      }),
    );
    const pad = inset + stroke + m * 0.35;
    box = { x: pad, y: pad, w: W - 2 * pad, h: H - 2 * pad };
  }

  const gap = m * 0.6;
  let align: Align = c.align ?? 'center';
  if (c.code) {
    const sideways = W >= H * 1.2;
    if (c.code.type === 'qr') {
      if (sideways) {
        const side = Math.min(box.h, box.w * 0.45);
        out.push(place({ ...createElement('qr', size), value: c.code.value } as LabelElement, { x: box.x + box.w - side, y: box.y + (box.h - side) / 2, w: side, h: side }));
        box = { ...box, w: box.w - side - gap };
        align = c.align ?? 'left';
      } else {
        const side = Math.min(box.w * 0.6, box.h * 0.55);
        out.push(place({ ...createElement('qr', size), value: c.code.value } as LabelElement, { x: box.x + (box.w - side) / 2, y: box.y + box.h - side, w: side, h: side }));
        box = { ...box, h: box.h - side - gap };
      }
    } else {
      const barcode = { ...createElement('barcode', size), format: c.code.type, value: c.code.value, showText: H >= 20 } as LabelElement;
      if (H >= 20) {
        const bh = box.h * 0.4;
        out.push(place(barcode, { x: box.x, y: box.y + box.h - bh, w: box.w, h: bh }));
        box = { ...box, h: box.h - bh - gap };
      } else {
        const bw = box.w * 0.5;
        out.push(place(barcode, { x: box.x + box.w - bw, y: box.y, w: bw, h: box.h }));
        box = { ...box, w: box.w - bw - gap };
        align = c.align ?? 'left';
      }
    }
  }

  if (c.icon) {
    const icon = { ...createElement('icon', size), name: c.icon.name, weight: 'fill', body: c.icon.body } as LabelElement;
    if (W >= H * 1.2) {
      const side = Math.min(box.h * 0.9, box.w * 0.3);
      out.push(place(icon, { x: box.x, y: box.y + (box.h - side) / 2, w: side, h: side }));
      box = { ...box, x: box.x + side + gap, w: box.w - side - gap };
      align = c.align ?? 'left';
    } else {
      // A lone title leaves room for a bigger icon, sign style.
      const share = c.lines?.length || c.pre ? 0.38 : 0.5;
      const side = Math.min(box.w * 0.55, box.h * share);
      out.push(place(icon, { x: box.x + (box.w - side) / 2, y: box.y, w: side, h: side }));
      box = { ...box, y: box.y + side + gap, h: box.h - side - gap };
    }
  }

  // Short boxes hold the title and at most one detail line; extra lines join onto it.
  const strip = box.h < 12;
  const maxLines = strip ? (box.h >= 7 ? 1 : 0) : Math.max(1, Math.floor(box.h / 5) - 1);
  let lines = c.lines ?? [];
  if (lines.length > maxLines) lines = maxLines === 0 ? [] : [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' · ')];
  const pre = strip ? undefined : c.pre;
  const title = c.upper ? c.title.toUpperCase() : c.title;

  const units = (pre ? 0.6 : 0) + (lines.length ? 2 : 1) + lines.length * 0.8 + (c.style === 'divider' && lines.length ? 0.35 : 0);
  const unit = box.h / units;
  let y = box.y;
  if (pre) {
    out.push(text({ x: box.x, y, w: box.w, h: unit * 0.6 }, pre, c.bodyFont, false, align));
    y += unit * 0.6;
  }
  const titleH = unit * (lines.length ? 2 : 1);
  out.push(text({ x: box.x, y, w: box.w, h: titleH }, title, c.font, c.titleBold, align));
  y += titleH;
  if (c.style === 'divider' && lines.length) {
    out.push(place({ ...createElement('line', size), strokeWidth: 0.3 } as LabelElement, { x: box.x, y, w: box.w, h: unit * 0.35 }));
    y += unit * 0.35;
  }
  for (const line of lines) {
    out.push(text({ x: box.x, y, w: box.w, h: unit * 0.8 }, line, c.bodyFont, false, align));
    y += unit * 0.8;
  }
  return out;
}
