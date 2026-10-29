import * as RD from '@radix-ui/react-dialog';
import { BatteryMedium, Bluetooth, ChevronRight, Crosshair, Ruler, FlaskConical, Loader2, MoveHorizontal, MoveVertical, Plug, Printer, RotateCcw, ScanLine, TriangleAlert, Unplug, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { sizeLabel, type LabelSize } from '../doc/model';
import { unsupportedReason, type ConnectionKind } from '../printer/client';
import { MANUAL_PROFILES, printheadMm } from '../printer/profiles';
import type { PrintOffset, PrinterStatus } from '../printer/service';
import { NumberField } from './fields';
import { ErrorBoundary } from '../ui/ErrorBoundary';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  status: PrinterStatus;
  /** The roll size, from the printer or remembered for this roll. */
  rollSize: LabelSize | null;
  /** The printer cannot measure the roll and its size is not known yet. */
  rollNeedsSize?: boolean;
  /** Product name of a recognised roll. */
  rollName?: string;
  onSetRollSize?: () => void;
  manualProfileId: string | null;
  onConnect: (kind: ConnectionKind) => Promise<void>;
  /** Prints a ruler label for reading the offset. */
  onAlignmentTest: () => Promise<void>;
  /** Print position nudge for the connected printer. */
  offset: PrintOffset;
  onOffset: (offset: PrintOffset) => void;
  onDisconnect: () => Promise<void>;
  onManualProfile: (id: string | null) => void;
}

interface Option {
  kind: ConnectionKind;
  icon: typeof Bluetooth;
  title: string;
  hint: string;
  /** Why the option cannot be used here, if it cannot. */
  unavailable?: string;
}

function Meter({ icon, label, value, detail, fraction, low }: { icon: ReactNode; label: string; value: string; detail?: string; fraction?: number; low?: boolean }) {
  return (
    <div className={`meter${low ? ' meter-low' : ''}`}>
      <div className="meter-head">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {fraction !== undefined && (
        <div className="meter-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
          <span style={{ width: `${Math.max(3, Math.min(100, fraction * 100))}%` }} />
        </div>
      )}
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Connect({ onConnect }: Pick<Props, 'onConnect'>) {
  const [busy, setBusy] = useState<ConnectionKind | null>(null);
  const options: Option[] = [
    { kind: 'bluetooth', icon: Bluetooth, title: 'Bluetooth', hint: 'Wireless. Works with most models.', unavailable: unsupportedReason('bluetooth') ?? undefined },
    { kind: 'serial', icon: Plug, title: 'USB cable', hint: 'For printers with a USB port.', unavailable: unsupportedReason('serial') ?? undefined },
    { kind: 'demo', icon: FlaskConical, title: 'Demo printer', hint: 'Try everything without hardware.' },
  ];

  const connect = async (kind: ConnectionKind) => {
    setBusy(kind);
    try {
      await onConnect(kind);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="pd-hero" aria-hidden="true">
        <div className="pd-hero-icon">
          <Printer size={34} strokeWidth={1.6} />
        </div>
      </div>
      <RD.Title className="pd-title">Connect a printer</RD.Title>
      <RD.Description className="pd-subtitle">Turn the printer on, then choose how it connects.</RD.Description>
      <div className="pd-options">
        {options.map(({ kind, icon: Icon, title, hint, unavailable }) => (
          <button key={kind} className="pd-option" disabled={!!unavailable || busy !== null} onClick={() => void connect(kind)} aria-label={title}>
            <span className="pd-option-icon">{busy === kind ? <Loader2 size={20} className="spin" /> : <Icon size={20} />}</span>
            <span className="pd-option-text">
              <strong>{title}</strong>
              <small>{busy === kind && kind !== 'demo' ? 'Pick your printer in the browser window' : (unavailable ?? hint)}</small>
            </span>
            <ChevronRight size={18} className="pd-option-go" />
          </button>
        ))}
      </div>
    </>
  );
}

function PrintPosition({ status, onAlignmentTest, offset, onOffset }: Pick<Props, 'status' | 'onAlignmentTest' | 'offset' | 'onOffset'>) {
  const moved = offset.x !== 0 || offset.y !== 0;
  return (
    <section className="pd-section" aria-labelledby="pd-position">
      <h3 id="pd-position" className="pd-section-title">
        <Crosshair size={15} /> Print position
      </h3>
      <div className="pd-test-row">
        <button className="btn" onClick={() => void onAlignmentTest()} disabled={status.state === 'printing'}>
          <Ruler size={16} /> Print test
        </button>
        <small className="muted">If a ruler end is cut off, move the print away from it by the first number you can read.</small>
      </div>
      <div className="pd-offset">
        <NumberField label="Move right" icon={<MoveHorizontal size={14} />} value={offset.x} min={-5} max={5} step={0.25} suffix="mm" onChange={(x) => onOffset({ ...offset, x })} />
        <NumberField label="Move down" icon={<MoveVertical size={14} />} value={offset.y} min={-5} max={5} step={0.25} suffix="mm" onChange={(y) => onOffset({ ...offset, y })} />
        <button className="icon-btn" aria-label="Reset position" title="Reset position" disabled={!moved} onClick={() => onOffset({ x: 0, y: 0 })}>
          <RotateCcw size={15} />
        </button>
      </div>
    </section>
  );
}

function Connected(props: Props) {
  const { status, rollSize, rollName, rollNeedsSize, onSetRollSize, onDisconnect } = props;
  const label = status.label;
  const battery = status.battery;
  const used = label?.remaining !== undefined && label.capacity ? label.remaining / label.capacity : undefined;
  const warnings = [status.lidClosed === false && 'Lid is open', status.paperInserted === false && 'No labels loaded'].filter(Boolean) as string[];

  return (
    <>
      <div className="pd-device">
        <div className="pd-device-icon">
          <Printer size={28} strokeWidth={1.6} />
          <span className={`pd-dot pd-dot-${status.state}`} />
        </div>
        <div className="pd-device-text">
          <RD.Title className="pd-title">{status.profile?.name ?? status.detectedModel ?? 'Printer'}</RD.Title>
          <RD.Description className="pd-subtitle">
            {status.state === 'printing' ? 'Printing…' : 'Ready'} · {status.deviceName ?? 'Unknown device'}
          </RD.Description>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="pd-warnings" role="status">
          {warnings.map((w) => (
            <span key={w}>
              <TriangleAlert size={15} /> {w}
            </span>
          ))}
        </div>
      )}

      <div className="pd-meters">
        <Meter
          icon={<BatteryMedium size={15} />}
          label="Battery"
          value={battery !== undefined ? `${battery}%` : 'Unknown'}
          fraction={battery !== undefined ? battery / 100 : undefined}
          low={battery !== undefined && battery <= 20}
        />
        <Meter
          icon={<ScanLine size={15} />}
          label="Roll"
          value={rollSize ? `${sizeLabel(rollSize)} mm` : label ? 'Size unknown' : 'No roll'}
          fraction={used}
          low={used !== undefined && used <= 0.1}
          detail={[rollName, label?.remaining !== undefined ? `${label.remaining} labels left` : null].filter(Boolean).join(' · ') || undefined}
        />
      </div>

      {rollNeedsSize && onSetRollSize && (
        <button className="pd-callout" onClick={onSetRollSize}>
          <ScanLine size={18} />
          <span>
            <strong>Tell niimai this roll's size</strong>
            <small>This printer does not report it. You only need to do this once per roll.</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      <PrintPosition {...props} />

      <button className="btn btn-ghost pd-disconnect" onClick={() => void onDisconnect()}>
        <Unplug size={16} /> Disconnect
      </button>
    </>
  );
}

/** Connecting, and the connected printer at a glance. */
export function PrinterDialog(props: Props) {
  const { open, onOpenChange, status, manualProfileId, onManualProfile } = props;
  const connected = status.state === 'ready' || status.state === 'printing';
  const unrecognised = connected && !status.detectedModel;

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="dialog-overlay" />
        <RD.Content className="dialog pd" onOpenAutoFocus={(e) => (e.preventDefault(), (e.currentTarget as HTMLElement).focus())}>
          <RD.Close className="icon-btn pd-close" aria-label="Close">
            <X size={18} />
          </RD.Close>
          <ErrorBoundary name="Printer">
            {connected ? <Connected {...props} /> : <Connect onConnect={props.onConnect} />}
            <details className="pd-advanced" open={unrecognised || undefined}>
              <summary>{unrecognised ? 'Printer not recognised' : 'Advanced'}</summary>
              <label className="pd-field">
                <span>Printer type, if not recognised</span>
                <select className="select" value={manualProfileId ?? ''} onChange={(e) => onManualProfile(e.target.value || null)}>
                  <option value="">None</option>
                  {MANUAL_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {Math.round(printheadMm(p))} mm head
                    </option>
                  ))}
                </select>
              </label>
              {unrecognised && !status.profile && <p className="field-error">Pick the closest type to start printing.</p>}
            </details>
          </ErrorBoundary>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
