import { ArrowRight, Battery, Bluetooth, Check, ChevronDown, ChevronRight, ChevronUp, FilePlus2, FlaskConical, LayoutTemplate, Loader2, Plug, Printer, ScanLine, Search, Settings, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LABEL_PRESETS, type LabelDoc, type LabelSize, sizeLabel } from '../doc/model';
import { type ConnectionKind, type PrinterStatus, supportsBluetooth, supportIssue, THERMAL_DEFAULT_SIZE } from 'libniimai';
import { useUsbRoute } from '../printer/usbRoute';
import { sameSize, type RollState } from '../printer/roll';
import { ensureFont } from '../render/fonts';
import { deleteLabel, listLabels } from '../storage/db';
import { useConfirm } from '../ui/Dialog';
import { IconButton } from '../ui/IconButton';
import { filterTemplates, labelFromTemplate, TEMPLATE_FONTS, TEMPLATES, templatePreview, templatesForSize } from '../templates';
import { continuousTemplates } from '../templates/continuous';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { connectFailed, SupportNote } from '../ui/setup';
import { NumberField } from './fields';
import { LabelSilhouette } from './LabelSizePicker';
import { LabelThumb, templateLabel, type TemplateSeed } from './LibraryDialog';

interface Props {
  status: PrinterStatus;
  roll: RollState;
  /** Sticker rolls on printers that cannot sense the gaps: the gap between stickers. Unset is continuous paper. */
  stickerGap?: number;
  /** The paper's width on a continuous-paper printer. */
  paperWidth?: number;
  /** The length new labels start at there, kept per printer; held here when not given. */
  labelLength?: number;
  onLabelLength?: (mm: number) => void;
  /** Size for blank labels and template suggestions when no roll is loaded. */
  defaultSize: LabelSize;
  onConnect: (kind: ConnectionKind) => Promise<void>;
  /** The printer type picked under Advanced, which steers USB to label and receipt printers. */
  printerType?: string | null;
  onSetRollSize: () => void;
  /** Opens the printer window: paper feed, print position and the rest. */
  onPrinterSettings: () => void;
  onOpen: (doc: LabelDoc) => void;
  onBlank: (size: LabelSize) => void;
  onBrowseTemplates: (seed?: TemplateSeed) => void;
}


function PrinterCard({ status, roll, stickerGap, paperWidth = THERMAL_DEFAULT_SIZE.widthMm, labelLength, onLabelLength, onConnect, printerType = null, onSetRollSize, onPrinterSettings, onBlank, onBrowseTemplates }: Pick<Props, 'status' | 'roll' | 'stickerGap' | 'paperWidth' | 'labelLength' | 'onLabelLength' | 'onConnect' | 'printerType' | 'onSetRollSize' | 'onPrinterSettings' | 'onBlank' | 'onBrowseTemplates'>) {
  const usb = useUsbRoute(printerType);
  /** The connection being made; its button shows a spinner in place of its icon. */
  const [busy, setBusy] = useState<ConnectionKind | null>(null);
  /** Length of a new label on continuous paper. */
  const [localLength, setLocalLength] = useState(THERMAL_DEFAULT_SIZE.heightMm);
  const length = labelLength ?? localLength;
  const setLength = onLabelLength ?? setLocalLength;
  const connected = status.state === 'ready' || status.state === 'printing';
  const connect = async (kind: ConnectionKind) => {
    setBusy(kind);
    try {
      await onConnect(kind);
    } catch (err) {
      connectFailed(err);
    } finally {
      setBusy(null);
    }
  };
  const icon = (kind: ConnectionKind, Icon: typeof Bluetooth) => (busy === kind ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Icon size={16} />);

  return (
    <section className={`start-card${connected ? ' start-card-done' : ''}`} aria-labelledby="start-printer">
      <span className="start-step">{connected ? <Check size={16} /> : 1}</span>
      {connected ? (
        <div className="start-card-title">
          <h2 id="start-printer">{status.profile?.name ?? status.deviceName ?? 'Printer'}</h2>
          <button className="icon-btn" aria-label="Printer settings" title="Printer settings" onClick={onPrinterSettings}>
            <Settings size={17} />
          </button>
        </div>
      ) : (
        <h2 id="start-printer">Connect your printer</h2>
      )}
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
            <button className="start-roll start-roll-button" onClick={onPrinterSettings} aria-label="Paper settings">
              <LabelSilhouette size={{ widthMm: paperWidth, heightMm: length }} box={64} />
              <span className="start-roll-text">
                <strong>{stickerGap !== undefined ? 'Stickers' : 'Continuous paper'}</strong>
                <small className="muted">
                  {stickerGap !== undefined && `${stickerGap} mm gap · `}
                  {paperWidth} mm wide
                </small>
              </span>
              <ChevronRight size={18} className="start-roll-go" />
            </button>
          ) : roll.size ? (
            <div className="start-roll">
              <LabelSilhouette size={roll.size} box={64} />
              <div className="start-roll-text">
                <strong>{sizeLabel(roll.size)} mm</strong>
                <small className="muted">{roll.name ?? (roll.manual ? 'Roll size you set' : 'Loaded roll')}</small>
              </div>
            </div>
          ) : (
            <p className="muted">{roll.needsSize ? 'This printer does not report the roll size.' : 'No roll detected. Load one to start from it.'}</p>
          )}
          <div className="start-actions start-roll-actions">
            {status.profile?.kind === 'thermal' ? (
              <>
                <NumberField label="Length" icon="Length" value={length} min={5} max={500} step={1} suffix="mm" onChange={setLength} />
                <button className="btn btn-primary" onClick={() => onBlank({ widthMm: paperWidth, heightMm: length })}>
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
                {roll.manual && (
                  <button className="btn btn-ghost" onClick={onSetRollSize} title="Change roll size">
                    <ScanLine size={16} /> Change size
                  </button>
                )}
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
            <button className="btn btn-primary" disabled={!supportsBluetooth() || !!busy} aria-busy={busy === 'bluetooth'} onClick={() => void connect('bluetooth')}>
              {icon('bluetooth', Bluetooth)} Bluetooth
            </button>
            <button className="btn" disabled={!!supportIssue(usb.primary) || !!busy} aria-busy={busy === 'serial' || busy === 'usb'} onClick={() => void connect(usb.primary)}>
              {icon(busy === 'usb' ? 'usb' : 'serial', Plug)} USB
            </button>
            <button className="btn btn-ghost" disabled={!!busy} aria-busy={busy === 'demo'} onClick={() => void connect('demo')} title="Try the app without a printer">
              {icon('demo', FlaskConical)} Demo
            </button>
          </div>
          {(() => {
            const issue = supportIssue('bluetooth') ?? supportIssue(usb.primary);
            return issue && <SupportNote issue={issue} />;
          })()}
          {usb.other && (
            <p className="muted small">
              <button className="link-btn" disabled={!!busy} onClick={() => void connect(usb.other!)}>
                USB printer not listed?
              </button>
            </p>
          )}
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

function TemplatesCard({ size, onOpen, onBrowse, continuous }: { size: LabelSize; onOpen: (d: LabelDoc) => void; onBrowse: (seed?: TemplateSeed) => void; /** Continuous paper's width, when that is loaded. */ continuous?: number }) {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let live = true;
    void Promise.race([Promise.allSettled(TEMPLATE_FONTS.map(ensureFont)), new Promise((r) => setTimeout(r, 2500))]).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  const forSize = useMemo(() => [...(continuous ? continuousTemplates(continuous) : []), ...templatesForSize(size)], [size, continuous]);
  const picks = useMemo(() => {
    const q = query.trim();
    // Searching shows the best matches; otherwise a spread across categories, icon versions first.
    if (q) return filterTemplates(forSize, { query: q }).slice(0, 6);
    // Continuous paper shows its own templates first.
    if (continuous) return continuousTemplates(continuous).slice(0, 6);
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

/** Recent labels shown before the rest are folded away. */
export const RECENT_SHOWN = 6;

function Recent({ onOpen }: Pick<Props, 'onOpen'>) {
  const [labels, setLabels] = useState<LabelDoc[]>([]);
  const [all, setAll] = useState(false);
  const confirm = useConfirm();
  const refresh = () => listLabels().then(setLabels, () => {});
  useEffect(() => void refresh(), []);
  const remove = async (doc: LabelDoc) => {
    if (!(await confirm({ title: `Delete “${doc.name}”?`, confirmLabel: 'Delete', danger: true }))) return;
    await deleteLabel(doc.id);
    void refresh();
  };
  if (!labels.length) return null;
  const shown = all ? labels : labels.slice(0, RECENT_SHOWN);
  return (
    <section className="start-recent" aria-labelledby="start-recent">
      <header>
        <h2 id="start-recent">Recent</h2>
        {labels.length > RECENT_SHOWN && (
          <button className="btn btn-ghost btn-sm" onClick={() => setAll((a) => !a)} aria-expanded={all}>
            {all ? (
              <>
                <ChevronUp size={15} /> Show fewer
              </>
            ) : (
              <>
                <ChevronDown size={15} /> Show all {labels.length}
              </>
            )}
          </button>
        )}
      </header>
      <ul className="start-templates" aria-label="Recent labels">
        {shown.map((d) => (
          <li key={d.id} className="recent-item">
            <button onClick={() => onOpen(d)} aria-label={`Open ${d.name}`}>
              <LabelThumb doc={d} />
              <span>{d.name}</span>
              {d.printer && (
                <span className="recent-printer">
                  <Printer size={11} aria-hidden="true" /> {d.printer}
                </span>
              )}
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
              stickerGap={props.stickerGap}
              paperWidth={props.paperWidth}
              labelLength={props.labelLength}
              onLabelLength={props.onLabelLength}
              onConnect={props.onConnect}
              printerType={props.printerType}
              onSetRollSize={props.onSetRollSize}
              onPrinterSettings={props.onPrinterSettings}
              onBlank={props.onBlank}
              onBrowseTemplates={props.onBrowseTemplates}
            />
          </ErrorBoundary>
          <ErrorBoundary name="Blank label">
            <BlankCard size={size} roll={props.roll} onBlank={props.onBlank} />
          </ErrorBoundary>
          <ErrorBoundary name="Templates">
            <TemplatesCard size={size} onOpen={props.onOpen} onBrowse={props.onBrowseTemplates} continuous={props.status.profile?.kind === 'thermal' && props.stickerGap === undefined ? (props.paperWidth ?? THERMAL_DEFAULT_SIZE.widthMm) : undefined} />
          </ErrorBoundary>
        </div>
        <ErrorBoundary name="Recent labels">
          <Recent onOpen={props.onOpen} />
        </ErrorBoundary>
      </div>
    </main>
  );
}
