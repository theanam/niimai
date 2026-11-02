import { useEffect, useState } from 'react';
import { sizeLabel, type LabelSize } from '../doc/model';
import { Dialog } from '../ui/Dialog';
import { NumberField } from './fields';
import { LabelSilhouette } from './LabelSizePicker';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  printerName: string;
  /** The label's current size. */
  current: LabelSize;
  /** The paper's width: the print width, or the narrower paper set for this printer. */
  widthMm: number;
  onSwitch: (size: LabelSize) => void;
}

/** Offers to move a label onto continuous paper: the paper's width, at a length of the user's choosing. */
export function ContinuousDialog({ open, onOpenChange, printerName, current, widthMm, onSwitch }: Props) {
  const [length, setLength] = useState(current.heightMm);
  useEffect(() => {
    if (open) setLength(current.heightMm);
  }, [open, current.heightMm]);
  const size = { widthMm: widthMm, heightMm: length };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Use ${widthMm} mm wide paper?`}
      description={`${printerName} prints on continuous paper ${widthMm} mm wide. This label is ${sizeLabel(current)} mm.`}
      footer={
        <>
          <button className="btn" onClick={() => onOpenChange(false)}>
            Keep {sizeLabel(current)}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onSwitch(size);
              onOpenChange(false);
            }}
          >
            Use {sizeLabel(size)} mm
          </button>
        </>
      }
    >
      <div className="continuous-size">
        <LabelSilhouette size={size} box={72} />
        <div className="grid-2">
          <div className="field field-number field-fixed" title="Width" aria-label={`Width ${widthMm} mm`}>
            <span className="field-label">W</span>
            <span className="field-value">{widthMm}</span>
            <span className="field-suffix">mm</span>
          </div>
          <NumberField label="Length" icon="L" value={length} min={5} max={500} step={1} suffix="mm" onChange={setLength} />
        </div>
      </div>
    </Dialog>
  );
}
