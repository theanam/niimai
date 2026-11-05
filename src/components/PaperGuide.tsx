import { Crosshair, Ruler, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { EdgeZoom, ScaleDrawing } from './ScaleDrawing';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sticker paper is picked; its guide is marked and the loading steps are for stickers. */
  stickers: boolean;
  /** The tab shown each time the guide opens. */
  initialTab?: Tab;
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

/** Top view of a printer with the lid open: a sticker gap on the print head, the roll between the guides. */
const Loading = ({ stickers }: { stickers: boolean }) => (
  <svg viewBox="0 0 340 250" aria-hidden="true">
    <rect className="mg-body" x={70} y={70} width={200} height={200} rx={14} />
    {stickers ? (
      <>
        <rect className="mg-liner" x={110} y={10} width={120} height={260} />
        {[{ y: 0, h: 116 }, { y: 124, h: 80 }, { y: 212, h: 80 }].map(({ y, h }) => (
          <rect key={y} className="mg-sticker" x={118} y={y} width={104} height={h} rx={6} />
        ))}
        <rect className="mg-gap" x={110} y={116} width={120} height={8} />
      </>
    ) : (
      <rect className="mg-sheet" x={110} y={10} width={120} height={260} />
    )}
    <line className="mg-head" x1={80} y1={120} x2={260} y2={120} />
    <rect className="mg-guide" x={101} y={160} width={6} height={44} rx={2} />
    <rect className="mg-guide" x={233} y={160} width={6} height={44} rx={2} />
    <g className="mg-dim">
      <text x={64} y={120} textAnchor="end" dominantBaseline="middle">
        Print head
      </text>
      {stickers && (
        <text x={274} y={120} dominantBaseline="middle">
          Gap
        </text>
      )}
      <text x={94} y={182} textAnchor="end" dominantBaseline="middle">
        Guide
      </text>
      <line x1={250} y1={58} x2={250} y2={22} />
      <path className="mg-arrow" d="M244 30 L250 20 L256 30" />
      <text x={258} y={40} dominantBaseline="middle">
        Out
      </text>
    </g>
  </svg>
);

const TABS = [
  { id: 'measure', label: 'Measure', icon: Ruler },
  { id: 'load', label: 'Load', icon: ScanLine },
  { id: 'lineup', label: 'Line up', icon: Crosshair },
] as const;
export type Tab = (typeof TABS)[number]['id'];

/** Paper on printers that cannot sense it: how to measure continuous rolls and sticker rolls, and how to load them. */
export function PaperGuide({ open, onOpenChange, stickers, initialTab = 'measure' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);
  // Lining up is for sticker rolls only.
  const tabs = TABS.filter((t) => stickers || t.id !== 'lineup');
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Paper guide" wide>
      <div className="tabs" role="tablist" aria-label="Paper guide">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'measure' ? (
        <div className="mg-panel" role="tabpanel" aria-label="Measure">
          <p className="muted mg-lead">Measure in mm with a ruler.</p>
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
        </div>
      ) : tab === 'lineup' && stickers ? (
        <div className="mg-panel mg-load" role="tabpanel" aria-label="Line up">
          <div className="mg-figures">
            <figure className="mg-card">
              <ScaleDrawing />
            </figure>
            <figure className="mg-card">
              <EdgeZoom />
              <figcaption>Where an edge cuts the scale off, count the marks from the nearest number: each mark is 1 mm.</figcaption>
            </figure>
          </div>
          <ol className="mg-steps">
            <li>
              <strong>Load the roll as it is.</strong> The scale starts wherever the paper sits.
            </li>
            <li>
              <strong>Print the scale.</strong> It runs over three stickers or more, and shows only on the stickers.
            </li>
            <li>
              <strong>Answer one question at a time.</strong> Each shows which edge to read: a sticker's top and bottom, the next sticker's top, the last sticker's top, then its left and right edges.
            </li>
            <li>
              <strong>Check the result:</strong> the sticker size and gap should look right.
            </li>
            <li>
              <strong>Fix size, gap and position</strong> sets the sticker size, the gap and where the print sits, then moves the paper so the next sticker starts at the print head. Fix before printing anything else.
            </li>
          </ol>
        </div>
      ) : (
        <div className="mg-panel mg-load" role="tabpanel" aria-label="Load">
          <figure className="mg-card">
            <Loading stickers={stickers} />
          </figure>
          <ol className="mg-steps">
            <li>
              <strong>Printing side to the head.</strong> Scratch the paper with a nail: the side that turns dark prints.
            </li>
            <li>
              <strong>Centre the roll</strong> between the guides.
            </li>
            {stickers ? (
              <li>
                <strong>Put a gap on the print head,</strong> the thin strip the roller presses on, then close the lid. Each print then feeds exactly one sticker and one gap.
              </li>
            ) : (
              <li>
                <strong>Pull a little paper out</strong> past the lid, then close it.
              </li>
            )}
            {stickers && (
              <li>
                <strong>Peel printed stickers off.</strong> Tearing the backing can pull the next sticker out of line.
              </li>
            )}
            <li>
              <strong>Print starts too high or low?</strong> Feed a little, or set Print position in the printer window.
            </li>
          </ol>
        </div>
      )}
    </Dialog>
  );
}
