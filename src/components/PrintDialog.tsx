import { Minus, Plus, Printer as PrinterIcon, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LabelDoc } from '../doc/model';
import type { PrinterStatus } from '../printer/service';
import type { PrinterProfile } from '../printer/profiles';
import { printheadMm } from '../printer/profiles';
import { Dialog } from '../ui/Dialog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: LabelDoc;
  status: PrinterStatus;
  preview: string | null;
  density: number;
  onDensity: (d: number) => void;
  onPrint: (copies: number) => Promise<void>;
  onBrowserPrint: (copies: number) => Promise<void>;
  onConnect: () => void;
}

/** Labels wider than the printhead print clipped; flag it before paper is wasted. */
export function sizeWarning(doc: Pick<LabelDoc, 'widthMm' | 'heightMm'>, profile: PrinterProfile | null): string | null {
  if (!profile) return null;
  const head = printheadMm(profile);
  const across = profile.printDirection === 'left' ? doc.heightMm : doc.widthMm;
  return across > head + 0.5 ? `Wider than the ${Math.round(head)} mm printhead` : null;
}

export function PrintDialog({ open, onOpenChange, doc, status, preview, density, onDensity, onPrint, onBrowserPrint, onConnect }: Props) {
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setBusy(false);
  }, [open]);

  const connected = status.state === 'ready' || status.state === 'printing';
  const profile = status.profile;
  const warning = sizeWarning(doc, profile);
  const printing = status.state === 'printing';

  const run = async (fn: (c: number) => Promise<void>) => {
    setBusy(true);
    try {
      await fn(copies);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Print"
      footer={
        <>
          <button className="btn" disabled={busy} onClick={() => void run(onBrowserPrint)} title="Print from the browser">
            <FileText size={16} /> Browser
          </button>
          {connected ? (
            <button className="btn btn-primary" disabled={busy || printing || !profile} onClick={() => void run(onPrint)}>
              <PrinterIcon size={16} />
              {printing && status.progress ? `${status.progress.page}/${status.progress.total}` : 'Print'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onConnect}>
              <PrinterIcon size={16} /> Connect
            </button>
          )}
        </>
      }
    >
      <div className="print-preview">
        {preview ? <img src={preview} alt="Print preview" /> : <div className="print-preview-empty" />}
      </div>
      <div className="row row-spread">
        <div className="stepper" aria-label="Copies">
          <button className="icon-btn" aria-label="Fewer copies" onClick={() => setCopies((c) => Math.max(1, c - 1))}>
            <Minus size={16} />
          </button>
          <input
            type="number"
            aria-label="Copies"
            min={1}
            max={999}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
          />
          <button className="icon-btn" aria-label="More copies" onClick={() => setCopies((c) => Math.min(999, c + 1))}>
            <Plus size={16} />
          </button>
        </div>
        {profile && (
          <label className="field field-range" title="Density">
            <span className="field-label-text">Density</span>
            <input
              type="range"
              aria-label="Density"
              min={profile.densityMin}
              max={profile.densityMax}
              value={Math.min(profile.densityMax, Math.max(profile.densityMin, density))}
              onChange={(e) => onDensity(Number(e.target.value))}
            />
            <output>{Math.min(profile.densityMax, Math.max(profile.densityMin, density))}</output>
          </label>
        )}
      </div>
      {warning && <p className="field-error">{warning}</p>}
      {connected && !profile && <p className="field-error">Pick your printer type in printer settings.</p>}
    </Dialog>
  );
}
