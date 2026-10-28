export type FrameStyle =
  | 'single'
  | 'rounded'
  | 'pill'
  | 'double'
  | 'thick-thin'
  | 'dashed'
  | 'dotted'
  | 'corners'
  | 'ticket'
  | 'scalloped'
  | 'shadow';

export const FRAME_STYLES: { value: FrameStyle; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
  { value: 'double', label: 'Double' },
  { value: 'thick-thin', label: 'Thick and thin' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'corners', label: 'Corners' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'scalloped', label: 'Scalloped' },
  { value: 'shadow', label: 'Shadow' },
];

export const isFrameStyle = (v: unknown): v is FrameStyle => FRAME_STYLES.some((f) => f.value === v);

const n = (v: number): string => String(Math.round(v * 1000) / 1000);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rect = ({ x, y, w, h }: Box, s: number, ink: string, extra = ''): string =>
  `<rect x="${n(x + s / 2)}" y="${n(y + s / 2)}" width="${n(Math.max(0, w - s))}" height="${n(Math.max(0, h - s))}" ` +
  `fill="none" stroke="${ink}" stroke-width="${n(s)}"${extra}/>`;

const inset = ({ x, y, w, h }: Box, d: number): Box => ({ x: x + d, y: y + d, w: Math.max(0, w - d * 2), h: Math.max(0, h - d * 2) });

const path = (d: string, s: number, ink: string, extra = ''): string =>
  `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${n(s)}"${extra}/>`;

/** Concave quarter circles cut from each corner, like a ticket stub. */
function ticketPath(b: Box, s: number): string {
  const { x, y, w, h } = inset(b, s / 2);
  const r = Math.min(w, h) * 0.2;
  return (
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 0 ${n(x + w)} ${n(y + r)}` +
    `V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 0 ${n(x + w - r)} ${n(y + h)}` +
    `H${n(x + r)}A${n(r)} ${n(r)} 0 0 0 ${n(x)} ${n(y + h - r)}` +
    `V${n(y + r)}A${n(r)} ${n(r)} 0 0 0 ${n(x + r)} ${n(y)}Z`
  );
}

/** Half-ellipse bumps along every edge, bulging outward to the box. */
function scallopPath(b: Box, s: number): string {
  const depth = Math.min(1.5, Math.max(0.5, Math.min(b.w, b.h) * 0.08));
  const { x, y, w, h } = inset(b, s / 2 + depth);
  const target = Math.min(4, Math.max(1.5, Math.min(b.w, b.h) / 4));
  const nx = Math.max(2, Math.round(w / target));
  const ny = Math.max(1, Math.round(h / target));
  const sx = w / nx;
  const sy = h / ny;
  const arc = (rx: number, ry: number, px: number, py: number) => `A${n(rx)} ${n(ry)} 0 0 1 ${n(px)} ${n(py)}`;
  let d = `M${n(x)} ${n(y)}`;
  for (let i = 1; i <= nx; i++) d += arc(sx / 2, depth, x + sx * i, y);
  for (let i = 1; i <= ny; i++) d += arc(depth, sy / 2, x + w, y + sy * i);
  for (let i = 1; i <= nx; i++) d += arc(sx / 2, depth, x + w - sx * i, y + h);
  for (let i = 1; i <= ny; i++) d += arc(depth, sy / 2, x, y + h - sy * i);
  return d + 'Z';
}

/** L-shaped brackets at the four corners. */
function cornersPath(b: Box, s: number): string {
  const { x, y, w, h } = inset(b, s / 2);
  const a = Math.min(w, h) * 0.35;
  return (
    `M${n(x)} ${n(y + a)}V${n(y)}H${n(x + a)}` +
    `M${n(x + w - a)} ${n(y)}H${n(x + w)}V${n(y + a)}` +
    `M${n(x + w)} ${n(y + h - a)}V${n(y + h)}H${n(x + w - a)}` +
    `M${n(x + a)} ${n(y + h)}H${n(x)}V${n(y + h - a)}`
  );
}

/** A frame drawn into the given box, in millimetres. */
export function frameSvg(style: FrameStyle, b: Box, s: number, ink = '#000'): string {
  s = Math.max(0.05, Math.min(s, Math.min(b.w, b.h) / 4));
  switch (style) {
    case 'single':
      return rect(b, s, ink);
    case 'rounded':
      return rect(b, s, ink, ` rx="${n(Math.min(b.w, b.h) * 0.2)}"`);
    case 'pill':
      return rect(b, s, ink, ` rx="${n((Math.min(b.w, b.h) - s) / 2)}"`);
    case 'double': {
      const gap = Math.max(0.6, s * 1.5);
      return rect(b, s, ink) + rect(inset(b, s + gap), s, ink);
    }
    case 'thick-thin': {
      const thin = Math.max(0.2, s / 2);
      return rect(b, s * 2, ink) + rect(inset(b, s * 2 + Math.max(0.5, s)), thin, ink);
    }
    case 'dashed':
      return rect(b, s, ink, ` stroke-dasharray="${n(s * 4)} ${n(s * 2.5)}"`);
    case 'dotted':
      return rect(b, s, ink, ` stroke-linecap="round" stroke-dasharray="0 ${n(s * 2.2)}"`);
    case 'corners':
      return path(cornersPath(b, s), s, ink, ' stroke-linecap="square"');
    case 'ticket':
      return path(ticketPath(b, s), s, ink);
    case 'scalloped':
      return path(scallopPath(b, s), s, ink, ' stroke-linejoin="round"');
    case 'shadow': {
      // An outline with a solid offset edge along the right and bottom.
      const off = Math.max(0.6, s * 1.5);
      const mw = b.w - off;
      const mh = b.h - off;
      const { x, y } = b;
      const shade =
        `M${n(x + mw)} ${n(y + off)}H${n(x + b.w)}V${n(y + b.h)}H${n(x + off)}V${n(y + mh)}H${n(x + mw)}Z`;
      return `<path d="${shade}" fill="${ink}"/>` + rect({ x, y, w: mw, h: mh }, s, ink);
    }
  }
}
