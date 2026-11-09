import * as RD from '@radix-ui/react-dialog';
import { ArrowDownToLine, ArrowUpFromLine, BatteryMedium, Bluetooth, BookOpen, ChevronRight, CircleHelp, CopyPlus, Crosshair, Download, Ruler, FlaskConical, Loader2, MoveHorizontal, MoveVertical, Pencil, Plug, Printer, RotateCcw, Save, ScanLine, Trash2, TriangleAlert, Unplug, Upload, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { sizeLabel, type LabelSize } from '../doc/model';
import { type ConnectionKind, findPrinterType, MANUAL_PROFILES, PRINTER_TYPES, type PrinterStatus, printheadMm, type PrintOffset, supportIssue, type SupportIssue } from 'libniimai';
import { NumberField } from './fields';
import { PaperGuide, type Tab as GuideTab } from './PaperGuide';
import { MAX_OFFSET_MM } from '../printer/scale';
import { StickerLineUp } from './StickerLineUp';
import { DEFAULT_GAP_MM, MAX_GAP_MM, MAX_LENGTH_MM, MAX_PAPER_MM, MIN_LENGTH_MM, MIN_PAPER_MM } from '../printer/thermalPaper';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Dialog, useConfirm } from '../ui/Dialog';
import { paperSummary, stickerPapers, suggestName, type PaperPreset, type PaperValues } from '../printer/paperPresets';
import { connectFailed, setupHref } from '../ui/setup';
import { useUsbRoute } from '../printer/usbRoute';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  status: PrinterStatus;
  /** The roll size, from the printer or remembered for this roll. */
  rollSize: LabelSize | null;
  /** The printer cannot measure the roll and its size is not known yet. */
  rollNeedsSize?: boolean;
  /** The printer never senses rolls; the user sets the size and changes it for another roll. */
  rollManual?: boolean;
  /** Product name of a recognised roll. */
  rollName?: string;
  onSetRollSize?: () => void;
  /** Printers that find the gaps but never learn the sticker size: common sizes to offer, and setting the size. */
  rollSizes?: LabelSize[];
  onRollSize?: (size: LabelSize) => void;
  manualProfileId: string | null;
  onConnect: (kind: ConnectionKind) => Promise<void>;
  /** Prints a ruler label for reading the offset. */
  onAlignmentTest: () => Promise<void>;
  /** Print position nudge for the connected printer. */
  offset: PrintOffset;
  onOffset: (offset: PrintOffset) => void;
  /** Moves the paper by mm, back into the printer when negative, on printers that cannot sense it. */
  onFeed?: (mm: number) => Promise<void>;
  /** Sticker rolls on printers that cannot sense the gaps: the gap between stickers. Unset is continuous paper. */
  stickerGap?: number;
  /** Sets the sticker gap; null goes back to continuous paper. */
  onStickerGap?: (gap: number | null) => void;
  /** Prints the sticker scale, sized for stickers about this many mm long, from wherever the paper sits. Resolves to the length printed. */
  onStickerTest?: (aboutMm: number) => Promise<number>;
  /** The paper's width on printers that cannot sense it, and the head's. */
  paperWidth?: number;
  headWidth?: number;
  onPaperWidth?: (width: number) => void;
  /** The length new labels start at on those printers. */
  labelLength?: number;
  onLabelLength?: (mm: number) => void;
  /** Saved papers, the one loaded on this printer, and whether its settings changed since. */
  papers?: PaperPreset[];
  paperPreset?: PaperPreset | null;
  paperModified?: boolean;
  /** The printer's paper settings now, for naming a new paper. */
  paperNow?: PaperValues;
  onChoosePaper?: (id: string | null) => void;
  onSavePaper?: () => void;
  onSavePaperAs?: (name: string) => void;
  onRenamePaper?: (id: string, name: string) => void;
  onDeletePaper?: (id: string) => void;
  /** Saves or loads every printer setting and saved paper as a file. */
  onExportSettings?: () => void;
  onImportSettings?: () => void;
  onDisconnect: () => Promise<void>;
  onManualProfile: (id: string | null) => void;
}

interface Option {
  kind: ConnectionKind;
  icon: typeof Bluetooth;
  title: string;
  hint: string;
  /** Why the option cannot be used here, if it cannot. */
  unavailable?: SupportIssue | null;
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

function Connect({ onConnect, manualProfileId }: Pick<Props, 'onConnect' | 'manualProfileId'>) {
  const [busy, setBusy] = useState<ConnectionKind | null>(null);
  const usb = useUsbRoute(manualProfileId);
  const options: Option[] = [
    { kind: 'bluetooth', icon: Bluetooth, title: 'Bluetooth', hint: 'Wireless. Works with most models.', unavailable: supportIssue('bluetooth') },
    { kind: usb.primary, icon: Plug, title: 'USB cable', hint: 'For printers with a USB port.', unavailable: supportIssue(usb.primary) },
    { kind: 'demo', icon: FlaskConical, title: 'Demo printer', hint: 'Try everything without hardware.' },
  ];

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
  // One link per fix; Brave, say, needs the same one for both.
  const fixes = [...new Set(options.flatMap((o) => (o.unavailable ? [o.unavailable.topic] : [])))].map((topic) => ({
    topic,
    names: options.filter((o) => o.unavailable?.topic === topic).map((o) => o.title.replace(' cable', '')),
  }));

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
              <small>{busy === kind && kind !== 'demo' ? 'Pick your printer in the browser window' : (unavailable?.reason ?? hint)}</small>
            </span>
            <ChevronRight size={18} className="pd-option-go" />
          </button>
        ))}
      </div>
      {usb.other && (
        <button className="pd-setup link-btn" disabled={busy !== null} onClick={() => void connect(usb.other!)}>
          <Plug size={15} /> USB printer not listed?
        </button>
      )}
      {fixes.map(({ topic, names }) => (
        <a key={topic} className="pd-setup" href={setupHref(topic)}>
          <CircleHelp size={15} /> How to fix {names.join(' and ')}
        </a>
      ))}
    </>
  );
}

function PrintPosition({ status, onAlignmentTest, offset, onOffset }: Pick<Props, 'status' | 'onAlignmentTest' | 'offset' | 'onOffset'>) {
  const moved = offset.x !== 0 || offset.y !== 0;
  // Rolls on printers that cannot sense the paper can sit well off the head's middle.
  const across = status.canFeed ? MAX_OFFSET_MM : 5;
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
        <NumberField label="Move right" icon={<MoveHorizontal size={14} />} value={offset.x} min={-across} max={across} step={0.25} suffix="mm" onChange={(x) => onOffset({ ...offset, x })} />
        <NumberField label="Move down" icon={<MoveVertical size={14} />} value={offset.y} min={-5} max={5} step={0.25} suffix="mm" onChange={(y) => onOffset({ ...offset, y })} />
        <button className="icon-btn" aria-label="Reset position" title="Reset position" disabled={!moved} onClick={() => onOffset({ x: 0, y: 0 })}>
          <RotateCcw size={15} />
        </button>
      </div>
    </section>
  );
}

/** How far one click moves the paper, until the user picks another length. */
export const FEED_STEP_MM = 0.5;
const FEED_KEY = 'niimai:feedStep';

/** The feed length last used, remembered on this device. */
function storedFeedStep(): number {
  try {
    const mm = Number(localStorage.getItem(FEED_KEY));
    return mm > 0 ? mm : FEED_STEP_MM;
  } catch {
    return FEED_STEP_MM;
  }
}

/** Asks for a paper's name in the app's own dialog. */
function PaperName({ open, title, initial, taken, onOpenChange, onSave }: { open: boolean; title: string; initial: string; taken: string[]; onOpenChange: (o: boolean) => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const [shown, setShown] = useState(open);
  // A fresh name each time it opens.
  if (open !== shown) {
    setShown(open);
    if (open) setName(initial);
  }
  const trimmed = name.trim();
  const clash = trimmed.toLowerCase() !== initial.toLowerCase() && taken.some((t) => t.toLowerCase() === trimmed.toLowerCase());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || clash) return;
    onSave(trimmed);
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      focusSelector="#paper-name input"
      footer={
        <>
          <button className="btn" onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="paper-name" disabled={!trimmed || clash}>
            <Save size={16} /> Save
          </button>
        </>
      }
    >
      <form id="paper-name" onSubmit={submit} className="pd-field">
        <span>Name</span>
        <input className="text-input" aria-label="Paper name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        {clash && <small className="field-error">A paper has this name already.</small>}
      </form>
    </Dialog>
  );
}

type PaperProps = Pick<Props, 'papers' | 'paperPreset' | 'paperModified' | 'paperNow' | 'onChoosePaper' | 'onSavePaper' | 'onSavePaperAs' | 'onRenamePaper' | 'onDeletePaper'> & {
  /** The printer finds the gaps itself: only sticker papers are offered, and their gap goes unmentioned. */
  gapSensed?: boolean;
};

/** Saved papers, the way slicers keep filament profiles: load one, then save changes over it or as a new one. */
function SavedPapers({ papers = [], paperPreset, paperModified, paperNow, onChoosePaper, onSavePaper, onSavePaperAs, onRenamePaper, onDeletePaper, gapSensed }: PaperProps) {
  const confirm = useConfirm();
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null);
  if (!onChoosePaper || !onSavePaperAs || !paperNow) return null;
  const shown = gapSensed ? stickerPapers(papers) : papers;
  const sorted = [...shown].sort((a, b) => a.name.localeCompare(b.name));
  const remove = async () => {
    if (!paperPreset || !onDeletePaper) return;
    if (await confirm({ title: `Delete ${paperPreset.name}?`, description: 'The printer keeps its current paper settings.', confirmLabel: 'Delete', danger: true })) onDeletePaper(paperPreset.id);
  };
  const note = paperPreset ? paperSummary(paperPreset, gapSensed) : shown.length ? null : 'Save this paper to load it again in one step.';
  return (
    <div className="pd-papers">
      <div className="pd-papers-row">
        <select className="select" aria-label="Saved paper" value={paperPreset?.id ?? ''} onChange={(e) => onChoosePaper(e.target.value || null)}>
          <option value="">{shown.length ? 'Unsaved paper' : 'No saved papers'}</option>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.id === paperPreset?.id && paperModified ? ' (changed)' : ''}
            </option>
          ))}
        </select>
        <button className="icon-btn" aria-label="Save as new paper" title="Save as new paper" onClick={() => setNaming('new')}>
          <CopyPlus size={16} />
        </button>
        {paperPreset && onRenamePaper && (
          <button className="icon-btn" aria-label="Rename paper" title="Rename paper" onClick={() => setNaming('rename')}>
            <Pencil size={15} />
          </button>
        )}
        {paperPreset && onDeletePaper && (
          <button className="icon-btn" aria-label="Delete paper" title="Delete paper" onClick={() => void remove()}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {paperPreset && paperModified ? (
        <div className="pd-papers-changed" role="status">
          <span>Changed since loaded</span>
          {onSavePaper && (
            <button className="btn btn-sm" onClick={onSavePaper}>
              <Save size={14} /> Save
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setNaming('new')}>
            <CopyPlus size={14} /> Save as new
          </button>
        </div>
      ) : (
        note && <small className="muted">{note}</small>
      )}
      <PaperName
        open={naming !== null}
        title={naming === 'rename' ? 'Rename paper' : 'Save as new paper'}
        initial={naming === 'rename' && paperPreset ? paperPreset.name : suggestName(paperNow, papers)}
        taken={papers.filter((p) => naming !== 'rename' || p.id !== paperPreset?.id).map((p) => p.name)}
        onOpenChange={(o) => !o && setNaming(null)}
        onSave={(name) => (naming === 'rename' && paperPreset ? onRenamePaper?.(paperPreset.id, name) : onSavePaperAs(name))}
      />
    </div>
  );
}

/** Paper on printers that cannot sense it: continuous or stickers, and moving it by hand to line it up. */
function Paper({
  status,
  onFeed,
  onStickerTest,
  onOffset,
  stickerGap,
  onStickerGap,
  paperWidth,
  headWidth,
  onPaperWidth,
  labelLength,
  onLabelLength,
  ...papers
}: Pick<Props, 'status' | 'onFeed' | 'onStickerTest' | 'onOffset' | 'stickerGap' | 'onStickerGap' | 'paperWidth' | 'headWidth' | 'onPaperWidth' | 'labelLength' | 'onLabelLength'> & PaperProps) {
  const feed = (mm: number) => void onFeed?.(mm).catch((err: Error) => toast.error(err.message));
  const [step, setStep] = useState(storedFeedStep);
  const changeStep = (mm: number) => {
    setStep(mm);
    try {
      localStorage.setItem(FEED_KEY, String(mm));
    } catch {
      // Private windows can refuse storage; the length still applies until the window closes.
    }
  };
  const [guide, setGuide] = useState<GuideTab | null>(null);
  const printing = status.state === 'printing';
  const stickers = stickerGap !== undefined;
  // Paper wider than the head is left unremarked: many printers take wider paper than their head prints.
  const wider = paperWidth !== undefined && headWidth !== undefined && paperWidth > headWidth;
  const paperNote =
    [
      headWidth !== undefined && paperWidth !== undefined && paperWidth < headWidth && `Prints centred on the ${headWidth} mm head.`,
      stickers ? 'Set W and L to the sticker size.' : onLabelLength && 'New labels start at this length.',
    ]
      .filter(Boolean)
      .join(' ') || (wider ? '' : `Paper up to ${headWidth ?? 48} mm wide prints edge to edge.`);
  const sized = !!onStickerGap || (!!onPaperWidth && paperWidth !== undefined) || (!!onLabelLength && labelLength !== undefined);
  return (
    <section className="pd-section" aria-labelledby="pd-paper">
      <div className="pd-section-head">
        <h3 id="pd-paper" className="pd-section-title">
          <ScanLine size={15} /> Paper
        </h3>
        {sized && (
          <button className="link-btn pd-guide" onClick={() => setGuide('measure')}>
            <BookOpen size={14} /> Paper guide
          </button>
        )}
      </div>
      <PaperGuide open={guide !== null} onOpenChange={(o) => !o && setGuide(null)} initialTab={guide ?? 'measure'} stickers={stickers} />
      {papers.onChoosePaper && <SavedPapers {...papers} />}
      {onStickerGap && (
        <div className="pd-paper-fields">
          <select
            className="select"
            aria-label="Paper type"
            value={stickers ? 'stickers' : 'continuous'}
            onChange={(e) => onStickerGap(e.target.value === 'stickers' ? DEFAULT_GAP_MM : null)}
          >
            <option value="continuous">Continuous</option>
            <option value="stickers">Stickers</option>
          </select>
          {stickers && <NumberField label="Gap" icon="Gap" value={stickerGap} min={0} max={MAX_GAP_MM} step={0.5} suffix="mm" onChange={(gap) => onStickerGap(gap)} />}
        </div>
      )}
      {((onPaperWidth && paperWidth !== undefined) || (onLabelLength && labelLength !== undefined)) && (
        <div className="pd-paper-fields">
          {onPaperWidth && paperWidth !== undefined && (
            <NumberField label="Paper width" icon="W" value={paperWidth} min={MIN_PAPER_MM} max={MAX_PAPER_MM} step={1} suffix="mm" onChange={onPaperWidth} />
          )}
          {onLabelLength && labelLength !== undefined && (
            <NumberField label="Label length" icon="L" value={labelLength} min={MIN_LENGTH_MM} max={MAX_LENGTH_MM} step={1} suffix="mm" onChange={onLabelLength} />
          )}
        </div>
      )}
      {paperNote && <small className="muted">{paperNote}</small>}
      {onFeed && (
        <div className="pd-feed-row">
          {status.canRetract && (
            <button className="btn" onClick={() => feed(-step)} disabled={printing}>
              <ArrowDownToLine size={16} /> Retract
            </button>
          )}
          <button className="btn" onClick={() => feed(step)} disabled={printing}>
            <ArrowUpFromLine size={16} /> Feed
          </button>
          <NumberField label="Feed length" icon="Step" value={step} min={0.5} max={50} step={0.5} suffix="mm" onChange={changeStep} />
        </div>
      )}
      {stickers && onStickerTest && onStickerGap && onFeed && onPaperWidth && onLabelLength && paperWidth !== undefined && labelLength !== undefined && (
        <StickerLineUp
          headWidth={headWidth ?? paperWidth}
          length={labelLength}
          gap={stickerGap}
          canRetract={!!status.canRetract}
          printing={printing}
          onTest={onStickerTest}
          onFix={(next, mm) => {
            onPaperWidth(next.width);
            onLabelLength(next.length);
            onStickerGap(next.gap);
            onOffset({ x: next.offsetX, y: next.offsetY });
            if (mm) feed(mm);
          }}
          onHelp={() => setGuide('lineup')}
        />
      )}
    </section>
  );
}

const sizeKey = (s: LabelSize) => `${s.widthMm}x${s.heightMm}`;

/**
 * Sticker paper on printers that find each sticker's edge but never learn its
 * size: saved papers, the common sizes, or any size typed in.
 */
function StickerPaper({ rollSize, rollSizes = [], onRollSize, ...papers }: Pick<Props, 'rollSize' | 'rollSizes'> & { onRollSize: (size: LabelSize) => void } & PaperProps) {
  const size = rollSize ?? rollSizes[0] ?? { widthMm: 50, heightMm: 30 };
  const common = rollSize && rollSizes.some((s) => sizeKey(s) === sizeKey(rollSize)) ? sizeKey(rollSize) : '';
  return (
    <section className="pd-section" aria-labelledby="pd-stickers">
      <h3 id="pd-stickers" className="pd-section-title">
        <ScanLine size={15} /> Paper
      </h3>
      {papers.onChoosePaper && <SavedPapers {...papers} gapSensed />}
      <div className="pd-paper-fields">
        <select
          className="select"
          aria-label="Common sizes"
          value={common}
          onChange={(e) => {
            const pick = rollSizes.find((s) => sizeKey(s) === e.target.value);
            if (pick) onRollSize(pick);
          }}
        >
          <option value="">{rollSize ? 'Custom size' : 'Pick a size'}</option>
          {rollSizes.map((s) => (
            <option key={sizeKey(s)} value={sizeKey(s)}>
              {sizeLabel(s)} mm
            </option>
          ))}
        </select>
      </div>
      <div className="pd-paper-fields">
        <NumberField label="Sticker width" icon="W" value={size.widthMm} min={MIN_PAPER_MM} max={MAX_PAPER_MM} step={1} suffix="mm" onChange={(widthMm) => onRollSize({ widthMm, heightMm: size.heightMm })} />
        <NumberField label="Sticker length" icon="L" value={size.heightMm} min={MIN_LENGTH_MM} max={MAX_LENGTH_MM} step={1} suffix="mm" onChange={(heightMm) => onRollSize({ widthMm: size.widthMm, heightMm })} />
      </div>
      <small className="muted">{rollSize ? 'The printer finds the gaps itself.' : 'This printer does not report the sticker size. Set it once and niimai remembers it.'}</small>
    </section>
  );
}

function Connected(props: Props) {
  const { status, rollSize, rollName, rollNeedsSize, rollManual, onSetRollSize, onDisconnect } = props;
  const title = status.profile?.name ?? status.detectedModel ?? 'Printer';
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
          <RD.Title className="pd-title">{title}</RD.Title>
          <RD.Description className="pd-subtitle">
            {status.state === 'printing' ? 'Printing…' : 'Ready'}
            {status.deviceName !== title && ` · ${status.deviceName ?? 'Unknown device'}`}
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
        {status.profile?.kind === 'thermal' ? (
          <Meter
            icon={<ScanLine size={15} />}
            label="Paper"
            value={props.paperPreset?.name ?? (props.stickerGap !== undefined ? 'Stickers' : 'Continuous')}
            detail={props.stickerGap !== undefined ? `${props.stickerGap} mm gap` : `${Math.round(printheadMm(status.profile))} mm print width`}
          />
        ) : (
          <Meter
            icon={<ScanLine size={15} />}
            label="Roll"
            value={rollSize ? `${sizeLabel(rollSize)} mm` : label ? 'Size unknown' : 'No roll'}
            fraction={used}
            low={used !== undefined && used <= 0.1}
            detail={[rollName, label?.remaining !== undefined ? `${label.remaining} labels left` : null].filter(Boolean).join(' · ') || undefined}
          />
        )}
      </div>

      {rollNeedsSize && onSetRollSize && !(rollManual && props.onRollSize) && (
        <button className="pd-callout" onClick={onSetRollSize}>
          <ScanLine size={18} />
          <span>
            <strong>Tell niimai this roll's size</strong>
            <small>{rollManual ? 'This printer does not report it. niimai remembers it for this printer.' : 'This printer does not report it. You only need to do this once per roll.'}</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}
      {rollManual && !rollNeedsSize && onSetRollSize && !props.onRollSize && (
        <button className="pd-callout" onClick={onSetRollSize}>
          <ScanLine size={18} />
          <span>
            <strong>Change roll size</strong>
            <small>Loaded another roll? Set its size here.</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      {rollManual && props.onRollSize && (
        <StickerPaper
          rollSize={rollSize}
          rollSizes={props.rollSizes}
          onRollSize={props.onRollSize}
          papers={props.papers}
          paperPreset={props.paperPreset}
          paperModified={props.paperModified}
          paperNow={props.paperNow}
          onChoosePaper={props.onChoosePaper}
          onSavePaper={props.onSavePaper}
          onSavePaperAs={props.onSavePaperAs}
          onRenamePaper={props.onRenamePaper}
          onDeletePaper={props.onDeletePaper}
        />
      )}

      {status.canFeed && (
        <Paper
          status={status}
          onFeed={props.onFeed}
          onStickerTest={props.onStickerTest}
          onOffset={props.onOffset}
          stickerGap={props.stickerGap}
          onStickerGap={props.onStickerGap}
          paperWidth={props.paperWidth}
          headWidth={props.headWidth}
          onPaperWidth={props.onPaperWidth}
          labelLength={props.labelLength}
          onLabelLength={props.onLabelLength}
          papers={props.papers}
          paperPreset={props.paperPreset}
          paperModified={props.paperModified}
          paperNow={props.paperNow}
          onChoosePaper={props.onChoosePaper}
          onSavePaper={props.onSavePaper}
          onSavePaperAs={props.onSavePaperAs}
          onRenamePaper={props.onRenamePaper}
          onDeletePaper={props.onDeletePaper}
        />
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
            {connected ? <Connected {...props} /> : <Connect onConnect={props.onConnect} manualProfileId={manualProfileId} />}
            <details className="pd-advanced" open={unrecognised || undefined}>
              <summary>{unrecognised ? 'Printer not recognised' : 'Advanced'}</summary>
              <label className="pd-field">
                <span>Printer type, if not recognised</span>
                <select className="select" value={manualProfileId ?? ''} onChange={(e) => onManualProfile(e.target.value || null)}>
                  <option value="">None</option>
                  <optgroup label="NIIMBOT">
                    {MANUAL_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {Math.round(printheadMm(p))} mm head
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other printers">
                    {PRINTER_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              {findPrinterType(manualProfileId) && !connected && <small className="muted">{findPrinterType(manualProfileId)!.family === 'cat' ? 'Bluetooth now lists every nearby device. Pick your printer there.' : 'Bluetooth now lists every nearby device, and USB lists printers. Pick yours there.'}</small>}
              {unrecognised && !status.profile && <p className="field-error">Pick the closest type to start printing.</p>}
              {(props.onExportSettings || props.onImportSettings) && (
                <div className="pd-field pd-settings">
                  <span>Printer settings and saved papers</span>
                  <div className="pd-settings-row">
                    {props.onExportSettings && (
                      <button className="btn" onClick={props.onExportSettings}>
                        <Download size={16} /> Save to file
                      </button>
                    )}
                    {props.onImportSettings && (
                      <button className="btn" onClick={props.onImportSettings}>
                        <Upload size={16} /> Load file
                      </button>
                    )}
                  </div>
                </div>
              )}
            </details>
          </ErrorBoundary>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
