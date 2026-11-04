import { Dialog } from '../ui/Dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The paper type picked now; its guide is marked. */
  stickers: boolean;
}

/** A measurement line with end ticks and its name, horizontal (y set) or vertical (x set). */
function Dim({ from, to, at, vertical, label, side = 'after' }: { from: number; to: number; at: number; vertical?: boolean; label: string; side?: 'before' | 'after' }) {
  const t = 4;
  if (vertical) {
    return (
      <g className="mg-dim">
        <line x1={at} y1={from} x2={at} y2={to} />
        <line x1={at - t} y1={from} x2={at + t} y2={from} />
        <line x1={at - t} y1={to} x2={at + t} y2={to} />
        <text x={side === 'after' ? at + 8 : at - 8} y={(from + to) / 2} textAnchor={side === 'after' ? 'start' : 'end'} dominantBaseline="middle">
          {label}
        </text>
      </g>
    );
  }
  return (
    <g className="mg-dim">
      <line x1={from} y1={at} x2={to} y2={at} />
      <line x1={from} y1={at - t} x2={from} y2={at + t} />
      <line x1={to} y1={at - t} x2={to} y2={at + t} />
      <text x={(from + to) / 2} y={at - 8} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/** Grey bars standing in for what a label prints. */
const Print = ({ x, y }: { x: number; y: number }) => (
  <g className="mg-print">
    <rect x={x} y={y} width={60} height={8} rx={2} />
    <rect x={x} y={y + 14} width={84} height={5} rx={2} />
    <rect x={x} y={y + 24} width={70} height={5} rx={2} />
  </g>
);

const Continuous = () => (
  <svg viewBox="-16 0 246 290" aria-hidden="true">
    <rect className="mg-paper" x={40} y={40} width={140} height={270} />
    {[120, 200, 280].map((y) => (
      <line key={y} className="mg-cut" x1={40} y1={y} x2={180} y2={y} />
    ))}
    <Print x={56} y={62} />
    <Print x={56} y={142} />
    <Print x={56} y={222} />
    <Dim from={40} to={180} at={24} label="W" />
    <Dim from={120} to={200} at={196} vertical label="L" />
  </svg>
);

const Stickers = () => (
  <svg viewBox="-16 0 246 290" aria-hidden="true">
    <rect className="mg-liner" x={40} y={40} width={140} height={270} />
    {[48, 140, 232].map((y) => (
      <g key={y}>
        <rect className="mg-sticker" x={52} y={y} width={116} height={80} rx={6} />
        <Print x={64} y={y + 22} />
      </g>
    ))}
    <line className="mg-ext" x1={52} y1={18} x2={52} y2={48} />
    <line className="mg-ext" x1={168} y1={18} x2={168} y2={48} />
    <Dim from={52} to={168} at={24} label="W" />
    <Dim from={140} to={220} at={196} vertical label="L" />
    <Dim from={128} to={140} at={26} vertical side="before" label="Gap" />
  </svg>
);

/** How to measure paper for printers that cannot sense it: continuous rolls and sticker rolls with gaps. */
export function MeasureGuide({ open, onOpenChange, stickers }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="How to measure" description="Measure in mm with a ruler." wide>
      <div className="mg-grid">
        <figure className={`mg-card${stickers ? ' mg-current' : ''}`}>
          <Stickers />
          <figcaption>
            <strong>Stickers</strong>
            <span>Measure one sticker on its own. The backing around it does not print.</span>
            <span>
              <b>W</b> sticker width · <b>L</b> sticker height · <b>Gap</b> space between two stickers
            </span>
          </figcaption>
        </figure>
        <figure className={`mg-card${stickers ? '' : ' mg-current'}`}>
          <Continuous />
          <figcaption>
            <strong>Continuous</strong>
            <span>One long strip. Each label is as long as you set it.</span>
            <span>
              <b>W</b> paper width · <b>L</b> label length
            </span>
          </figcaption>
        </figure>
      </div>
    </Dialog>
  );
}
