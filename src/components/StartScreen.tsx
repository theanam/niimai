import { ArrowRight, Battery, Bluetooth, Check, FilePlus2, FlaskConical, LayoutTemplate, Plug, Printer, ScanLine } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LABEL_PRESETS, type LabelDoc, type LabelSize } from '../doc/model';
import { supportsBluetooth, supportsSerial, type ConnectionKind } from '../printer/client';
import type { RollState } from '../printer/roll';
import type { PrinterStatus } from '../printer/service';
import { ensureFont } from '../render/fonts';
import { listLabels } from '../storage/db';
import { labelFromTemplate, TEMPLATE_FONTS, templatePreview, templatesForSize } from '../templates';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { NumberField } from './fields';
import { LabelThumb, templateLabel } from './LibraryDialog';

interface Props {
  status: PrinterStatus;
  roll: RollState;
  current: LabelDoc;
  onConnect: (kind: ConnectionKind) => Promise<void>;
  onSetRollSize: () => void;
  onOpen: (doc: LabelDoc) => void;
  onBlank: (size: LabelSize) => void;
  onBrowseTemplates: () => void;
  onContinue: () => void;
}

const sameSize = (a: LabelSize, b: LabelSize) => a.widthMm === b.widthMm && a.heightMm === b.heightMm;

function PrinterCard({ status, roll, onConnect, onSetRollSize }: Pick<Props, 'status' | 'roll' | 'onConnect' | 'onSetRollSize'>) {
  const [busy, setBusy] = useState(false);
  const connected = status.state === 'ready' || status.state === 'printing';
  const connect = async (kind: ConnectionKind) => {
    setBusy(true);
    try {
      await onConnect(kind);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`start-card${connected ? ' start-card-done' : ''}`} aria-labelledby="start-printer">
      <span className="start-step">{connected ? <Check size={16} /> : 1}</span>
      <h2 id="start-printer">{connected ? (status.profile?.name ?? status.deviceName ?? 'Printer') : 'Connect your printer'}</h2>
      {connected ? (
        <ul className="start-facts">
          {status.battery !== undefined && (
            <li>
              <Battery size={15} /> {status.battery}%
            </li>
          )}
          <li>
            <ScanLine size={15} />
            {roll.size ? (
              `${roll.size.widthMm} × ${roll.size.heightMm} mm roll`
            ) : roll.needsSize ? (
              <button className="link-btn" onClick={onSetRollSize}>
                Set roll size
              </button>
            ) : (
              'No roll detected'
            )}
            {status.label?.remaining !== undefined && <span className="muted"> · {status.label.remaining} left</span>}
          </li>
        </ul>
      ) : (
        <>
          <p className="muted">Bluetooth or USB, straight from the browser.</p>
          <div className="start-actions">
            <button className="btn btn-primary" disabled={!supportsBluetooth() || busy} onClick={() => void connect('bluetooth')}>
              <Bluetooth size={16} /> Bluetooth
            </button>
            <button className="btn" disabled={!supportsSerial() || busy} onClick={() => void connect('serial')}>
              <Plug size={16} /> USB
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void connect('demo')} title="Try the app without a printer">
              <FlaskConical size={16} /> Demo
            </button>
          </div>
          {!supportsBluetooth() && <p className="muted small">Printing needs Chrome or Edge.</p>}
          <div className="start-printer-art" aria-hidden="true">
            <Printer size={40} strokeWidth={1.4} />
            <div className="start-models">
              {['D11', 'D110', 'B1', 'B18', 'B21', 'B21 C2B', 'and more'].map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function BlankCard({ size, roll, onBlank }: { size: LabelSize; roll: RollState; onBlank: (s: LabelSize) => void }) {
  const [custom, setCustom] = useState<LabelSize>(size);
  useEffect(() => setCustom(size), [size]);
  const presets = roll.size ? [roll.size, ...LABEL_PRESETS.filter((p) => !sameSize(p, roll.size!))] : LABEL_PRESETS;
  return (
    <section className="start-card" aria-labelledby="start-blank">
      <span className="start-step">2</span>
      <h2 id="start-blank">Start blank</h2>
      <div className="start-sizes">
        {presets.slice(0, 6).map((p, i) => (
          <button key={`${p.widthMm}x${p.heightMm}`} className={`preset${roll.size && i === 0 ? ' preset-roll' : ''}`} onClick={() => onBlank(p)} aria-label={`Blank ${p.widthMm} × ${p.heightMm} mm`}>
            <span className="preset-shape" style={{ aspectRatio: `${p.widthMm} / ${p.heightMm}` }} />
            {p.widthMm} × {p.heightMm}
          </button>
        ))}
      </div>
      <div className="start-custom">
        <NumberField label="Width" icon="W" value={custom.widthMm} min={5} max={200} step={1} suffix="mm" onChange={(widthMm) => setCustom((c) => ({ ...c, widthMm }))} />
        <NumberField label="Height" icon="H" value={custom.heightMm} min={5} max={200} step={1} suffix="mm" onChange={(heightMm) => setCustom((c) => ({ ...c, heightMm }))} />
        <button className="btn" onClick={() => onBlank(custom)} aria-label="Create custom size">
          <FilePlus2 size={16} />
        </button>
      </div>
    </section>
  );
}

function TemplatesCard({ size, onOpen, onBrowse }: { size: LabelSize; onOpen: (d: LabelDoc) => void; onBrowse: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.race([Promise.allSettled(TEMPLATE_FONTS.map(ensureFont)), new Promise((r) => setTimeout(r, 2500))]).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  // A spread across categories reads better than the first few pantry jars.
  const picks = useMemo(() => {
    // Icon versions first: they show off more of what a label can hold.
    const all = templatesForSize(size).filter((t) => t.variant === 'icon');
    const seen = new Set<string>();
    return all.filter((t) => !seen.has(t.category) && seen.add(t.category)).slice(0, 6);
  }, [size]);

  return (
    <section className="start-card start-card-wide" aria-labelledby="start-templates">
      <span className="start-step">3</span>
      <h2 id="start-templates">Or begin from a template</h2>
      <p className="muted">
        Laid out for {size.widthMm} × {size.heightMm} mm.
      </p>
      <ul className="start-templates" aria-label="Suggested templates">
        {picks.map((t) => (
          <li key={t.id}>
            <button onClick={() => onOpen(labelFromTemplate(t))} aria-label={templateLabel(t)}>
              {ready ? <LabelThumb doc={templatePreview(t)} /> : <div className="thumb" />}
              <span>{t.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost start-more" onClick={onBrowse}>
        <LayoutTemplate size={16} /> All templates <ArrowRight size={14} />
      </button>
    </section>
  );
}

function Recent({ current, onOpen, onContinue }: Pick<Props, 'current' | 'onOpen' | 'onContinue'>) {
  const [labels, setLabels] = useState<LabelDoc[]>([]);
  useEffect(() => {
    listLabels().then((l) => setLabels(l.slice(0, 6)), () => {});
  }, []);
  if (!labels.length) return null;
  return (
    <section className="start-recent" aria-labelledby="start-recent">
      <header>
        <h2 id="start-recent">Recent</h2>
        <button className="btn btn-ghost" onClick={onContinue}>
          Continue “{current.name}” <ArrowRight size={14} />
        </button>
      </header>
      <ul className="start-templates" aria-label="Recent labels">
        {labels.map((d) => (
          <li key={d.id}>
            <button onClick={() => (d.id === current.id ? onContinue() : onOpen(d))} aria-label={`Open ${d.name}`}>
              <LabelThumb doc={d} />
              <span>{d.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Where every session begins: connect, start blank, or pick a template. */
export function StartScreen(props: Props) {
  const size = props.roll.size ?? { widthMm: props.current.widthMm, heightMm: props.current.heightMm };
  return (
    <main className="start">
      <div className="start-inner">
        <h1>What are we labelling?</h1>
        <div className="start-grid">
          <ErrorBoundary name="Printer">
            <PrinterCard status={props.status} roll={props.roll} onConnect={props.onConnect} onSetRollSize={props.onSetRollSize} />
          </ErrorBoundary>
          <ErrorBoundary name="Blank label">
            <BlankCard size={size} roll={props.roll} onBlank={props.onBlank} />
          </ErrorBoundary>
          <ErrorBoundary name="Templates">
            <TemplatesCard size={size} onOpen={props.onOpen} onBrowse={props.onBrowseTemplates} />
          </ErrorBoundary>
        </div>
        <ErrorBoundary name="Recent labels">
          <Recent current={props.current} onOpen={props.onOpen} onContinue={props.onContinue} />
        </ErrorBoundary>
      </div>
    </main>
  );
}
