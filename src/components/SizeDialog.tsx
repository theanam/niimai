import { Bookmark, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { LABEL_PRESETS, type LabelSize, sizeLabel } from '../doc/model';
import { Dialog } from '../ui/Dialog';
import { NumberField } from './fields';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  actionLabel: string;
  /** Offered first when known. */
  rollSize: LabelSize | null;
  initial?: LabelSize;
  /** Sizes to offer; the standard presets by default. */
  presets?: LabelSize[];
  description?: string;
  onPick: (size: LabelSize) => void;
  /** Papers the user saved, offered before the common sizes. */
  saved?: { id: string; name: string; size: LabelSize }[];
  onPickSaved?: (id: string) => void;
}

/** Picks a label size from presets or exact dimensions. Used for new labels and for naming a roll's size. */
export function SizeDialog({ open, onOpenChange, title, actionLabel, rollSize, initial, presets = LABEL_PRESETS, description, onPick, saved = [], onPickSaved }: Props) {
  const [size, setSize] = useState<LabelSize>(rollSize ?? initial ?? { widthMm: 40, heightMm: 12 });
  const pick = (s: LabelSize) => {
    onPick(s);
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <button className="btn btn-primary" onClick={() => pick(size)}>
          {actionLabel}
        </button>
      }
    >
      {saved.length > 0 && onPickSaved && (
        <div className="saved-papers" role="group" aria-label="Saved papers">
          {saved.map((p) => (
            <button
              key={p.id}
              className="saved-paper"
              onClick={() => {
                onPickSaved(p.id);
                onOpenChange(false);
              }}
            >
              <Bookmark size={15} />
              <span>
                <strong>{p.name}</strong>
                <small className="muted">{sizeLabel(p.size)} mm</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="preset-grid">
        {rollSize && (
          <button className="preset preset-roll" onClick={() => pick(rollSize)}>
            <ScanLine size={16} />
            {sizeLabel(rollSize)}
          </button>
        )}
        {presets.map((p) => (
          <button key={`${p.widthMm}x${p.heightMm}`} className="preset" onClick={() => pick(p)}>
            <span className="preset-shape" style={{ aspectRatio: `${p.widthMm} / ${p.heightMm}` }} />
            {sizeLabel(p)}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <NumberField label="Width" icon="W" value={size.widthMm} min={5} max={200} step={1} suffix="mm" onChange={(widthMm) => setSize((s) => ({ ...s, widthMm }))} />
        <NumberField label="Height" icon="H" value={size.heightMm} min={5} max={200} step={1} suffix="mm" onChange={(heightMm) => setSize((s) => ({ ...s, heightMm }))} />
      </div>
    </Dialog>
  );
}
