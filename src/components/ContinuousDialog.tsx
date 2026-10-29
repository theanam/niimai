import { useEffect, useState } from 'react';
import { sizeLabel, type LabelSize } from '../doc/model';
import { THERMAL_HEAD_MM } from '../printer/thermal';
import { Dialog } from '../ui/Dialog';
import { NumberField } from './fields';
import { LabelSilhouette } from './LabelSizePicker';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  printerName: string;
  /** The label's current size. */
  current: LabelSize;
  onSwitch: (size: LabelSize) => void;
}

/** Offers to move a label onto continuous paper: the full print width, at a length of the user's choosing. */
export function ContinuousDialog({ open, onOpenChange, printerName, current, onSwitch }: Props) {
  const [length, setLength] = useState(current.heightMm);
  useEffect(() => {
    if (open) setLength(current.heightMm);
  }, [open, current.heightMm]);
  const size = { widthMm: THERMAL_HEAD_MM, heightMm: length };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Use ${THERMAL_HEAD_MM} mm wide paper?`}
      description={`${printerName} prints on continuous paper ${THERMAL_HEAD_MM} mm wide. This label is ${sizeLabel(current)} mm.`}
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
          <div className="field field-number field-fixed" title="Width" aria-label={`Width ${THERMAL_HEAD_MM} mm`}>
            <span className="field-label">W</span>
            <span className="field-value">{THERMAL_HEAD_MM}</span>
            <span className="field-suffix">mm</span>
          </div>
          <NumberField label="Length" icon="L" value={length} min={5} max={500} step={1} suffix="mm" onChange={setLength} />
        </div>
      </div>
    </Dialog>
  );
}
