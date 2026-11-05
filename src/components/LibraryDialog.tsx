import { Copy, History, LayoutTemplate, Printer, Search, Shapes, Smile, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { sizeLabel, type LabelDoc, type LabelSize } from '../doc/model';
import { uid } from '../lib/units';
import { ensureFont } from '../render/fonts';
import { processImages } from '../render/raster';
import { resolveDoc } from '../doc/variables';
import { renderSvg } from '../render/svg';
import { deleteLabel, listLabels, saveLabel } from '../storage/db';
import { listPrints, type PrintRecord } from '../storage/recentPrints';
import {
  CATEGORIES,
  filterTemplates,
  labelFromTemplate,
  sizeKey,
  TEMPLATE_FONTS,
  TEMPLATE_SIZES,
  TEMPLATES,
  templatePreview,
  templatesForSize,
  type Template,
} from '../templates';
import { CONTINUOUS_CATEGORY, CONTINUOUS_TEMPLATES } from '../templates/continuous';
import { Dialog, useConfirm } from '../ui/Dialog';
import { useIncremental } from '../ui/useIncremental';
import { IconButton } from '../ui/IconButton';

export type LibraryTab = 'mine' | 'printed' | 'templates';
type Tab = LibraryTab;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentId: string;
  /** Templates are matched to this size until "All sizes" is chosen. */
  currentSize: LabelSize;
  onOpen: (doc: LabelDoc) => void;
  /** Opens a past print, and with again, the print window for it. */
  onOpenPrint?: (record: PrintRecord, again: boolean) => void;
  initialTab?: Tab;
  /** Where the Templates tab starts: a search, or one category. */
  templateSeed?: TemplateSeed;
  /** A continuous-paper printer is connected: its templates are offered too. */
  continuous?: boolean;
}

export interface TemplateSeed {
  query?: string;
  category?: string | null;
}

/** Resolution thumbnails process images at: the common NIIMBOT head. */
const THUMB_DPI = 203;
/** Processed images by label version, so reopening a list draws them at once. */
const thumbImages = new Map<string, Record<string, string>>();

/** Images as they will print (dithered, thresholded, inverted); none until ready. */
function usePrintedImages(doc: LabelDoc): Record<string, string> | undefined {
  const key = `${doc.id}:${doc.updatedAt}`;
  const hasImages = doc.elements.some((e) => e.type === 'image' && e.src);
  const [images, setImages] = useState(() => thumbImages.get(key));
  useEffect(() => {
    if (!hasImages) return;
    const cached = thumbImages.get(key);
    if (cached) return setImages(cached);
    let live = true;
    processImages(doc, THUMB_DPI).then(
      (imgs) => {
        thumbImages.set(key, imgs);
        if (live) setImages(imgs);
      },
      () => {},
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hasImages]);
  return hasImages ? images : undefined;
}

/** A label drawn to fit its card, whatever its proportions. */
export function LabelThumb({ doc }: { doc: LabelDoc }) {
  const fonts = useFontsVersion();
  const images = usePrintedImages(doc);
  // Auto-fit text is measured with whatever fonts are loaded, so re-render as more arrive.
  // Dynamic fields show the first record, as the label would print first.
  const svg = useMemo(() => renderSvg(resolveDoc(doc, { index: 0, now: new Date() }), { physicalSize: false, images }), [doc, fonts, images]);
  // Cards are 3:2. Wider labels fill the width, taller ones the height.
  const wide = doc.widthMm / doc.heightMm >= 1.5;
  return (
    <div className="thumb" aria-hidden="true">
      <div
        className="thumb-paper"
        style={{ aspectRatio: `${doc.widthMm} / ${doc.heightMm}`, width: wide ? '100%' : 'auto', height: wide ? 'auto' : '100%' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

/** Bumps whenever the page finishes loading fonts. */
function useFontsVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    const bump = () => setV((n) => n + 1);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);
  return v;
}

/** Accessible name for a template card. */
export const templateLabel = (t: Template): string =>
  `Use ${t.name}${t.variant === 'icon' ? ' with icon' : ''}, ${sizeLabel(t.size)} mm`;

const PAGE = 48;
const NONE: Template[] = [];

function MyLabels({ currentId, onOpen }: { currentId: string; onOpen: (d: LabelDoc) => void }) {
  const [labels, setLabels] = useState<LabelDoc[] | null>(null);
  const confirm = useConfirm();
  const refresh = () => listLabels().then(setLabels, () => setLabels([]));
  useEffect(() => void refresh(), []);

  const remove = async (doc: LabelDoc) => {
    if (!(await confirm({ title: `Delete “${doc.name}”?`, confirmLabel: 'Delete', danger: true }))) return;
    await deleteLabel(doc.id);
    void refresh();
  };

  const duplicate = async (doc: LabelDoc) => {
    const now = Date.now();
    await saveLabel({ ...doc, id: uid(), name: `${doc.name} copy`, fileName: undefined, createdAt: now, updatedAt: now });
    toast.success('Duplicated');
    void refresh();
  };

  if (labels && !labels.length) return <p className="library-empty muted">Saved labels appear here.</p>;
  return (
    <ul className="card-grid" aria-label="My labels">
      {labels?.map((doc) => (
        <li key={doc.id} className={`card${doc.id === currentId ? ' current' : ''}`}>
          <button className="card-open" onClick={() => onOpen(doc)} aria-label={`Open ${doc.name}`}>
            <LabelThumb doc={doc} />
          </button>
          <div className="card-meta">
            <div className="card-text">
              <strong title={doc.name}>{doc.name}</strong>
              <small>
                {sizeLabel(doc)} mm{doc.printer && ` · ${doc.printer}`}
              </small>
            </div>
            <IconButton label="Duplicate" onClick={() => void duplicate(doc)}>
              <Copy size={15} />
            </IconButton>
            <IconButton label="Delete" disabled={doc.id === currentId} onClick={() => void remove(doc)}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

const ago = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "5 minutes ago", "yesterday": the largest unit that fits. */
export function timeAgo(then: number, now = Date.now()): string {
  const s = Math.round((then - now) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) if (Math.abs(s) >= size) return ago.format(Math.round(s / size), unit);
  return ago.format(0, 'second');
}

function Printed({ onOpen }: { onOpen: (record: PrintRecord, again: boolean) => void }) {
  const [prints, setPrints] = useState<PrintRecord[] | null>(null);
  useEffect(() => void listPrints().then(setPrints, () => setPrints([])), []);
  if (prints && !prints.length) return <p className="library-empty muted">Labels you print appear here.</p>;
  return (
    <ul className="card-grid" aria-label="Printed">
      {prints?.map((record) => (
        <li key={`${record.doc.id}-${record.printedAt}`} className="card">
          <button className="card-open" onClick={() => onOpen(record, false)} aria-label={`Open ${record.doc.name}`}>
            <LabelThumb doc={record.doc} />
          </button>
          <div className="card-meta">
            <div className="card-text">
              <strong title={record.doc.name}>{record.doc.name}</strong>
              <small>
                {record.count} printed · {timeAgo(record.printedAt)}
              </small>
            </div>
            <IconButton label={`Print ${record.doc.name} again`} onClick={() => onOpen(record, true)}>
              <Printer size={15} />
            </IconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Templates({ currentSize, onOpen, seed, continuous = false }: { currentSize: LabelSize; onOpen: (d: LabelDoc) => void; seed?: TemplateSeed; continuous?: boolean }) {
  const [allSizes, setAllSizes] = useState(false);
  const [size, setSize] = useState<LabelSize | null>(null);
  // With continuous paper loaded, its own templates come first.
  const [category, setCategory] = useState<string | null>(seed?.category ?? (continuous && !seed?.query ? CONTINUOUS_CATEGORY.id : null));
  const [query, setQuery] = useState(seed?.query ?? '');
  const [fontsReady, setFontsReady] = useState(false);

  // Auto-fit text measures with the real fonts, so thumbnails wait for them (briefly).
  useEffect(() => {
    let live = true;
    const done = () => live && setFontsReady(true);
    void Promise.race([Promise.allSettled(TEMPLATE_FONTS.map(ensureFont)), new Promise((r) => setTimeout(r, 2500))]).then(done);
    return () => {
      live = false;
    };
  }, []);

  const base = useMemo(() => [...(continuous ? CONTINUOUS_TEMPLATES : []), ...(allSizes ? TEMPLATES : templatesForSize(currentSize))], [allSizes, currentSize, continuous]);
  const matching = useMemo(() => filterTemplates(base, { query, size: allSizes ? size : null }), [base, query, size, allSizes]);
  const shown = useMemo(() => (category ? matching.filter((t) => t.category === category) : matching), [matching, category]);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of matching) c.set(t.category, (c.get(t.category) ?? 0) + 1);
    return c;
  }, [matching]);
  const { visible, more, sentinel, showMore } = useIncremental(fontsReady ? shown : NONE, PAGE);

  return (
    <div className="templates">
      <div className="templates-bar">
        <label className="search">
          <Search size={15} />
          <input type="search" placeholder="Search templates" aria-label="Search templates" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="segmented" role="radiogroup" aria-label="Template sizes">
          <button role="radio" aria-checked={!allSizes} className={!allSizes ? 'active' : ''} onClick={() => setAllSizes(false)}>
            {sizeLabel(currentSize)}
          </button>
          <button role="radio" aria-checked={allSizes} className={allSizes ? 'active' : ''} onClick={() => setAllSizes(true)}>
            All sizes
          </button>
        </div>
      </div>
      {allSizes && (
        <div className="chips size-chips" aria-label="Filter by size">
          <button className={`chip${!size ? ' active' : ''}`} onClick={() => setSize(null)}>
            Any
          </button>
          {TEMPLATE_SIZES.map((s) => (
            <button key={sizeKey(s)} className={`chip${size && sizeKey(size) === sizeKey(s) ? ' active' : ''}`} onClick={() => setSize(s)}>
              {sizeLabel(s)}
            </button>
          ))}
        </div>
      )}
      <div className="templates-body">
        <nav className="categories" aria-label="Categories">
          <button className={!category ? 'active' : ''} onClick={() => setCategory(null)}>
            <span>All</span>
            <small>{matching.length}</small>
          </button>
          {[...(continuous ? [CONTINUOUS_CATEGORY] : []), ...CATEGORIES].map((c) => (
            <button key={c.id} className={category === c.id ? 'active' : ''} onClick={() => setCategory(c.id)} disabled={!counts.get(c.id)}>
              <span>{c.name}</span>
              <small>{counts.get(c.id) ?? 0}</small>
            </button>
          ))}
        </nav>
        <div className="templates-scroll">
          {!fontsReady && <p className="library-empty muted">Loading templates…</p>}
          {fontsReady && !shown.length && <p className="library-empty muted">No templates match.</p>}
          <ul className="card-grid" aria-label="Templates">
            {visible.map((t: Template) => (
              <li key={t.id} className="card">
                <button className="card-open" onClick={() => onOpen(labelFromTemplate(t))} aria-label={templateLabel(t)}>
                  <LabelThumb doc={templatePreview(t)} />
                </button>
                <div className="card-meta">
                  <div className="card-text">
                    <strong title={t.name}>{t.name}</strong>
                    <small>
                      {sizeLabel(t.size)} mm
                    </small>
                  </div>
                  {t.variant === 'icon' && <Smile size={15} className="card-badge" aria-label="With icon" />}
                </div>
              </li>
            ))}
          </ul>
          {more && (
            <div ref={sentinel} className="load-more">
              <button className="btn btn-ghost" onClick={showMore}>
                More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LibraryDialog({ open, onOpenChange, currentId, currentSize, onOpen, onOpenPrint = () => {}, initialTab = 'mine', templateSeed, continuous = false }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const openDoc = (doc: LabelDoc) => {
    onOpen(doc);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Library" className="dialog-library" focusContent>
      <div className="tabs" role="tablist" aria-label="Library">
        <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>
          <Shapes size={15} /> My labels
        </button>
        <button role="tab" aria-selected={tab === 'printed'} className={tab === 'printed' ? 'active' : ''} onClick={() => setTab('printed')}>
          <History size={15} /> Printed
        </button>
        <button role="tab" aria-selected={tab === 'templates'} className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          <LayoutTemplate size={15} /> Templates
        </button>
      </div>
      <div className="tab-panel" role="tabpanel">
        {tab === 'mine' ? (
          <MyLabels currentId={currentId} onOpen={openDoc} />
        ) : tab === 'printed' ? (
          <Printed
            onOpen={(record, again) => {
              // Closed first, so the print window it may open stays open.
              onOpenChange(false);
              onOpenPrint(record, again);
            }}
          />
        ) : (
          <Templates currentSize={currentSize} onOpen={openDoc} seed={templateSeed} continuous={continuous} />
        )}
      </div>
    </Dialog>
  );
}
