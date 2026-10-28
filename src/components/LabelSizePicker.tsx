import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { flagWidth, sizeLabel, type LabelSize } from '../doc/model';
import { sameSize } from '../printer/roll';

/**
 * A small drawing of a label: its proportions, a cable label's tail and a
 * folding flag's fold line. Fits a box of the given size.
 */
export function LabelSilhouette({ size, box = 40, pxPerMm }: { size: LabelSize; box?: number; pxPerMm?: number }) {
  const ratio = size.widthMm / size.heightMm;
  // With pxPerMm, labels share one scale so their sizes compare; very long ones shrink to fit.
  const scale = pxPerMm ? Math.min(pxPerMm, box / size.widthMm, box / size.heightMm) : 0;
  const w = scale ? size.widthMm * scale : ratio >= 1 ? box : box * ratio;
  const h = scale ? size.heightMm * scale : ratio >= 1 ? box / ratio : box;
  const tail = size.tailMm ? (size.tailMm / size.widthMm) * w : 0;
  const fold = size.fold ? (flagWidth(size) / 2 / size.widthMm) * w : 0;
  return (
    <svg className="silhouette" width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
      <g transform={`translate(${(box - w) / 2} ${(box - h) / 2})`}>
        <rect className="silhouette-paper" x={0.5} y={0.5} width={Math.max(1, w - 1)} height={Math.max(1, h - 1)} rx={Math.min(2, h / 4)} />
        {tail > 0 && <rect className="silhouette-tail" x={w - tail} y={0.5} width={tail - 0.5} height={Math.max(1, h - 1)} />}
        {fold > 0 && <line className="silhouette-fold" x1={fold} x2={fold} y1={0} y2={h} />}
      </g>
    </svg>
  );
}

interface Group {
  title: string;
  sizes: LabelSize[];
}

interface Props {
  value: LabelSize;
  /** The loaded roll, offered first. */
  rollSize: LabelSize | null;
  /** Sizes that suit the connected printer; empty when none is connected. */
  fitting: LabelSize[];
  /** Every known size. */
  all: LabelSize[];
  onChange: (size: LabelSize) => void;
}

const kind = (s: LabelSize): string | null => (s.tailMm ? (s.fold ? 'Cable flag, folds' : 'Cable flag') : s.fold ? 'Folds in the middle' : null);

/** Picks a label size from the presets, each shown as a silhouette. */
export function LabelSizePicker({ value, rollSize, fitting, all, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const taken = (s: LabelSize, groups: LabelSize[][]) => groups.some((g) => g.some((o) => sameSize(o, s)));
  const roll = rollSize ? [rollSize] : [];
  const fit = fitting.filter((s) => !taken(s, [roll]));
  const rest = all.filter((s) => !taken(s, [roll, fit]));
  const groups: Group[] = [
    { title: 'Loaded roll', sizes: roll },
    { title: 'Suits your printer', sizes: fit },
    { title: fit.length || roll.length ? 'Other sizes' : 'Sizes', sizes: rest },
  ].filter((g) => g.sizes.length);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="size-trigger" aria-label={`Label size: ${sizeLabel(value)} mm`}>
          <LabelSilhouette size={value} box={30} />
          <span className="size-trigger-text">
            <strong>{sizeLabel(value)} mm</strong>
            {kind(value) && <small>{kind(value)}</small>}
          </span>
          <ChevronDown size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover size-menu" sideOffset={6} align="start" role="listbox" aria-label="Label sizes">
          {groups.map((g) => (
            <div key={g.title} className="size-group">
              <div className="size-group-title">{g.title}</div>
              {g.sizes.map((s) => {
                const active = sameSize(s, value);
                return (
                  <button
                    key={sizeLabel(s) + (s.fold ?? '')}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`size-option${active ? ' active' : ''}`}
                    onClick={() => {
                      onChange(s);
                      setOpen(false);
                    }}
                  >
                    <LabelSilhouette size={s} box={52} pxPerMm={0.95} />
                    <span className="size-option-text">
                      <strong>{sizeLabel(s)} mm</strong>
                      {kind(s) && <small>{kind(s)}</small>}
                    </span>
                    {active && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
