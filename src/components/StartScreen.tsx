import { ArrowRight, Battery, Bluetooth, Check, FilePlus2, FlaskConical, LayoutTemplate, Plug, Printer, ScanLine, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LABEL_PRESETS, type LabelDoc, type LabelSize, sizeLabel } from '../doc/model';
import { supportsBluetooth, supportsSerial, unsupportedReason, type ConnectionKind } from '../printer/client';
import { THERMAL_DEFAULT_SIZE } from '../printer/thermal';
import { sameSize, type RollState } from '../printer/roll';
import type { PrinterStatus } from '../printer/service';
import { ensureFont } from '../render/fonts';
import { deleteLabel, listLabels } from '../storage/db';
import { useConfirm } from '../ui/Dialog';
import { IconButton } from '../ui/IconButton';
import { filterTemplates, labelFromTemplate, TEMPLATE_FONTS, TEMPLATES, templatePreview, templatesForSize } from '../templates';
import { CONTINUOUS_TEMPLATES } from '../templates/continuous';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { NumberField } from './fields';
import { LabelSilhouette } from './LabelSizePicker';
import { LabelThumb, templateLabel, type TemplateSeed } from './LibraryDialog';

interface Props {
  status: PrinterStatus;
  roll: RollState;
  /** Size for blank labels and template suggestions when no roll is loaded. */
  defaultSize: LabelSize;
  onConnect: (kind: ConnectionKind) => Promise<void>;
  onSetRollSize: () => void;
  onOpen: (doc: LabelDoc) => void;
  onBlank: (size: LabelSize) => void;
  onBrowseTemplates: (seed?: TemplateSeed) => void;
}


function PrinterCard({ status, roll, onConnect, onSetRollSize, onBlank, onBrowseTemplates }: Pick<Props, 'status' | 'roll' | 'onConnect' | 'onSetRollSize' | 'onBlank' | 'onBrowseTemplates'>) {
  const [busy, setBusy] = useState(false);
  /** Length of a new label on continuous paper. */
  const [length, setLength] = useState(THERMAL_DEFAULT_SIZE.heightMm);
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
        <>
          <ul className="start-facts start-facts-inline">
            {status.battery !== undefined && (
              <li>
                <Battery size={15} /> {status.battery}%
              </li>
            )}
            {status.label?.remaining !== undefined && (
              <li>
                <ScanLine size={15} /> {status.label.remaining} labels left
              </li>
            )}
          </ul>
          {status.profile?.kind === 'thermal' ? (
            <div className="start-roll">
              <LabelSilhouette size={{ widthMm: THERMAL_DEFAULT_SIZE.widthMm, heightMm: length }} box={64} />
              <div className="start-roll-text">
                <strong>Continuous paper</strong>
                <small className="muted">{THERMAL_DEFAULT_SIZE.widthMm} mm print width</small>
              </div>
            </div>
          ) : roll.size ? (
            <div className="start-roll">
              <LabelSilhouette size={roll.size} box={64} />
              <div className="start-roll-text">
                <strong>{sizeLabel(roll.size)} mm</strong>
                <small className="muted">{roll.name ?? 'Loaded roll'}</small>
              </div>
            </div>
          ) : (
            <p className="muted">{roll.needsSize ? 'This printer does not report the roll size.' : 'No roll detected. Load one to start from it.'}</p>
          )}
          <div className="start-actions start-roll-actions">
            {status.profile?.kind === 'thermal' ? (
              <>
                <NumberField label="Length" icon="Length" value={length} min={5} max={500} step={1} suffix="mm" onChange={setLength} />
                <button className="btn btn-primary" onClick={() => onBlank({ widthMm: THERMAL_DEFAULT_SIZE.widthMm, heightMm: length })}>
                  <FilePlus2 size={16} /> New label
                </button>
                <button className="btn" onClick={() => onBrowseTemplates()}>
                  <LayoutTemplate size={16} /> Templates
                </button>
              </>
            ) : roll.size ? (
              <>
                <button className="btn btn-primary" onClick={() => onBlank(roll.size!)}>
                  <FilePlus2 size={16} /> New {sizeLabel(roll.size)} label
                </button>
                <button className="btn" onClick={() => onBrowseTemplates()}>
                  <LayoutTemplate size={16} /> Templates for this roll
                </button>
              </>
            ) : (
              roll.needsSize && (
                <button className="btn btn-primary" onClick={onSetRollSize}>
                  <ScanLine size={16} /> Set roll size
                </button>
              )
            )}
          </div>
        </>
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
          {unsupportedReason('bluetooth') && <p className="muted small">{unsupportedReason('bluetooth')}.</p>}
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
          <button key={`${p.widthMm}x${p.heightMm}`} className={`preset${roll.size && i === 0 ? ' preset-roll' : ''}`} onClick={() => onBlank(p)} aria-label={`Blank ${sizeLabel(p)} mm`}>
            <span className="preset-shape" style={{ aspectRatio: `${p.widthMm} / ${p.heightMm}` }} />
            {sizeLabel(p)}
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

const TEMPLATE_COUNT = TEMPLATES.length.toLocaleString();

function TemplatesCard({ size, onOpen, onBrowse, continuous = false }: { size: LabelSize; onOpen: (d: LabelDoc) => void; onBrowse: (seed?: TemplateSeed) => void; continuous?: boolean }) {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let live = true;
    void Promise.race([Promise.allSettled(TEMPLATE_FONTS.map(ensureFont)), new Promise((r) => setTimeout(r, 2500))]).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  const forSize = useMemo(() => [...(continuous ? CONTINUOUS_TEMPLATES : []), ...templatesForSize(size)], [size, continuous]);
  const picks = useMemo(() => {
    const q = query.trim();
    // Searching shows the best matches; otherwise a spread across categories, icon versions first.
    if (q) return filterTemplates(forSize, { query: q }).slice(0, 6);
    // Continuous paper shows its own templates first.
    if (continuous) return CONTINUOUS_TEMPLATES.slice(0, 6);
    const seen = new Set<string>();
    return forSize.filter((t) => t.variant === 'icon' && !seen.has(t.category) && seen.add(t.category)).slice(0, 6);
  }, [forSize, query]);

  return (
    <section className="start-card start-card-wide" aria-labelledby="start-templates">
      <span className="start-step">3</span>
      <div className="start-templates-head">
        <div>
          <h2 id="start-templates">Or begin from a template</h2>
          <p className="muted">
            {continuous ? 'Lists, planners and notes for continuous paper.' : `${TEMPLATE_COUNT} templates, laid out for ${sizeLabel(size)} mm.`}
          </p>
        </div>
        <label className="start-template-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates" aria-label="Search templates" />
        </label>
      </div>
      {picks.length ? (
        <ul className="start-templates" aria-label={query.trim() ? 'Matching templates' : 'Suggested templates'}>
          {picks.map((t) => (
            <li key={t.id}>
              <button onClick={() => onOpen(labelFromTemplate(t))} aria-label={templateLabel(t)}>
                {ready ? <LabelThumb doc={templatePreview(t)} /> : <div className="thumb" />}
                <span>{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No templates match at this size.</p>
      )}
      <button className="btn btn-ghost start-more" onClick={() => onBrowse(query.trim() ? { query: query.trim() } : undefined)}>
        <LayoutTemplate size={16} /> {query.trim() ? 'See all matches' : `All ${TEMPLATE_COUNT} templates`} <ArrowRight size={14} />
      </button>
    </section>
  );
}

function Recent({ onOpen }: Pick<Props, 'onOpen'>) {
  const [labels, setLabels] = useState<LabelDoc[]>([]);
  const confirm = useConfirm();
  const refresh = () => listLabels().then((l) => setLabels(l.slice(0, 6)), () => {});
  useEffect(() => void refresh(), []);
  const remove = async (doc: LabelDoc) => {
    if (!(await confirm({ title: `Delete “${doc.name}”?`, confirmLabel: 'Delete', danger: true }))) return;
    await deleteLabel(doc.id);
    void refresh();
  };
  if (!labels.length) return null;
  return (
    <section className="start-recent" aria-labelledby="start-recent">
      <header>
        <h2 id="start-recent">Recent</h2>
      </header>
      <ul className="start-templates" aria-label="Recent labels">
        {labels.map((d) => (
          <li key={d.id} className="recent-item">
            <button onClick={() => onOpen(d)} aria-label={`Open ${d.name}`}>
              <LabelThumb doc={d} />
              <span>{d.name}</span>
            </button>
            <IconButton label={`Delete ${d.name}`} className="recent-delete" onClick={() => void remove(d)}>
              <Trash2 size={14} />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Where every session begins: connect, start blank, or pick a template. */
export function StartScreen(props: Props) {
  const size = props.roll.size ?? props.defaultSize;
  return (
    <main className="start">
      <div className="start-inner">
        <h1>What are we labelling?</h1>
        <div className="start-grid">
          <ErrorBoundary name="Printer">
            <PrinterCard
              status={props.status}
              roll={props.roll}
              onConnect={props.onConnect}
              onSetRollSize={props.onSetRollSize}
              onBlank={props.onBlank}
              onBrowseTemplates={props.onBrowseTemplates}
            />
          </ErrorBoundary>
          <ErrorBoundary name="Blank label">
            <BlankCard size={size} roll={props.roll} onBlank={props.onBlank} />
          </ErrorBoundary>
          <ErrorBoundary name="Templates">
            <TemplatesCard size={size} onOpen={props.onOpen} onBrowse={props.onBrowseTemplates} continuous={props.status.profile?.kind === 'thermal'} />
          </ErrorBoundary>
        </div>
        <ErrorBoundary name="Recent labels">
          <Recent onOpen={props.onOpen} />
        </ErrorBoundary>
      </div>
    </main>
  );
}
