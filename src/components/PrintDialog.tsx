import { BatteryMedium, ChevronRight, Minus, Plus, Printer as PrinterIcon, FileText, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sizeLabel, type LabelDoc, type LabelSize } from '../doc/model';
import { RollMismatchBanner } from './RollMismatchBanner';
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
  /** Resolve false when the print failed, so the copies are kept for a retry. */
  onPrint: (copies: number) => Promise<boolean | void>;
  onBrowserPrint: (copies: number) => Promise<boolean | void>;
  onConnect: () => void;
  /** The loaded roll's size, when known. */
  rollSize?: LabelSize | null;
  /** Product name of a recognised roll. */
  rollName?: string;
  onMatchRoll?: () => void;
  /** Some of the design's dots fall outside the printhead. */
  clipped?: boolean;
  /** Elements with details too fine for the printer. */
  issueCount?: number;
}

/** The printer at a glance, at the top of the dialog. Opens printer settings. */
function PrinterStrip({ status, rollSize, rollName, onOpen }: { status: PrinterStatus; rollSize: LabelSize | null; rollName?: string; onOpen: () => void }) {
  const connected = status.state === 'ready' || status.state === 'printing';
  const paper =
    status.profile?.kind === 'thermal'
      ? 'Continuous paper'
      : rollSize
        ? `${rollName ?? `${sizeLabel(rollSize)} mm roll`}`
        : status.label
          ? 'Roll size unknown'
          : null;
  return (
    <button type="button" className="print-printer" onClick={onOpen} aria-label={connected ? 'Printer settings' : 'Connect a printer'}>
      <span className="print-printer-icon">
        <PrinterIcon size={18} />
        <span className={`pd-dot pd-dot-${status.state}`} />
      </span>
      <span className="print-printer-text">
        <strong>{connected ? (status.profile?.name ?? status.detectedModel ?? status.deviceName ?? 'Printer') : 'No printer connected'}</strong>
        {connected && (
          <small>
            {status.battery !== undefined && (
              <span>
                <BatteryMedium size={13} /> {status.battery}%
              </span>
            )}
            {paper && (
              <span>
                <ScanLine size={13} /> {paper}
                {status.label?.remaining !== undefined && ` · ${status.label.remaining} left`}
              </span>
            )}
          </small>
        )}
      </span>
      <ChevronRight size={16} className="print-printer-go" />
    </button>
  );
}

/**
 * Flags a design that reaches past the printhead before paper is wasted. A
 * label wider than the head is fine as long as nothing prints outside it.
 */
export function sizeWarning(profile: PrinterProfile | null, clipped: boolean): string | null {
  if (!profile || !clipped) return null;
  return `Parts outside the ${Math.round(printheadMm(profile))} mm printhead will not print`;
}

export function PrintDialog({ open, onOpenChange, doc, status, preview, density, onDensity, onPrint, onBrowserPrint, onConnect, rollSize = null, rollName, onMatchRoll, clipped = false, issueCount = 0 }: Props) {
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setBusy(false);
  }, [open]);

  const connected = status.state === 'ready' || status.state === 'printing';
  const profile = status.profile;
  const warning = sizeWarning(profile, clipped);
  const printing = status.state === 'printing';

  const run = async (fn: (c: number) => Promise<boolean | void>) => {
    setBusy(true);
    try {
      // Every print starts again from one copy.
      if ((await fn(copies)) !== false) setCopies(1);
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
      <PrinterStrip status={status} rollSize={rollSize} rollName={rollName} onOpen={onConnect} />
      {onMatchRoll && <RollMismatchBanner doc={doc} rollSize={rollSize} rollPaper={status.label?.paper} onMatch={onMatchRoll} />}
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
        {/* Printers with a single heat setting (ESC/POS) have nothing to adjust. */}
        {profile && profile.densityMax > profile.densityMin && (
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
      {issueCount > 0 && (
        <p className="field-error">{issueCount === 1 ? 'One item has details too fine to print.' : `${issueCount} items have details too fine to print.`} The marked items show what to change.</p>
      )}
      {connected && !profile && <p className="field-error">Pick your printer type in printer settings.</p>}
    </Dialog>
  );
}
