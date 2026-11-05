import { LayoutTemplate, Loader2 } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { createDoc, createElement, onPaper, paperSize, parseDoc, serializeDoc, turnPatch, usedFonts, type ElementType, type LabelDoc, type LabelElement, type LabelSize } from '../doc/model';
import { useEditor } from '../doc/useEditor';
import { baseName, LABEL_EXT, openImageFile, openLabelFile, openSheetFile, readAsDataUrl, safeFileName, saveTextAs, writeToHandle, type FileHandle } from '../files/fs-access';
import { round1, uid } from '../lib/units';
import { printer } from '../printer';
import { type ConnectionKind, DEMO_NAME, effectivePaper, inkOutsideHead, labelTypeOf, type PrintOffset, printheadMm, type PrintOptions, rotateCanvas, type Rotation, THERMAL_DEFAULT_SIZE, THERMAL_HEAD_MM, THERMAL_SIZES } from 'libniimai';
import { allSizesFor, resolveRoll, sameSize, sizesForPrinter } from '../printer/roll';
import { asSvgBlob, isImageFile, isSvgFile, looksLikeSvg, svgSize } from '../files/svg';
import { browserPrint } from '../render/browserPrint';
import { linkFont } from '../render/fonts';
import { processImages, rasterize, standaloneSvg, standaloneSvgs } from '../render/raster';
import { readSheetFile } from '../files/sheet';
import { batchNeeds, resolveDoc } from '../doc/variables';
import type { BatchRun } from './PrintDialog';
import { matchShortcut } from '../shortcuts/shortcuts';
import { getLabel, getSetting, saveLabel, setSetting } from '../storage/db';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { AddBar } from './AddBar';
import { Canvas } from './Canvas';
import { Header } from './Header';
import { Inspector } from './Inspector';
import { IconPicker, type PickedIcon } from './IconPicker';
import { LibraryDialog, type LibraryTab, type TemplateSeed } from './LibraryDialog';
import { printedDoc, recordPrint, type PrintRecord } from '../storage/recentPrints';
import { SizeDialog } from './SizeDialog';
import { StartScreen } from './StartScreen';
import { PrintDialog } from './PrintDialog';
import { printIssues } from '../render/printability';
import { fitBorders, safeArea, turnedArea } from '../printer/safeArea';
import { alignmentDoc } from '../printer/alignment';
import { placeOnHead } from '../printer/onHead';
import { scaleDoc, scaleLength } from '../printer/scale';
import { stickerFeed, type LabelLengths, type PaperWidths, type StickerGaps } from '../printer/thermalPaper';
import { TEMPLATES } from '../templates';
import { RollMismatchBanner } from './RollMismatchBanner';
import { ContinuousDialog } from './ContinuousDialog';
import { PrinterDialog } from './PrinterDialog';
import { ShareDialog } from './ShareDialog';
import { decodeShare, sharedPart } from '../files/share';

type DialogName = 'new' | 'roll' | 'continuous' | 'library' | 'print' | 'printer' | 'icon' | 'share' | null;

const DEFAULT_DPI = 203;

/** A size as a document patch; always sets the tail, so a plain size clears a cable label's tail. */
/** Landscape labels print a quarter turn clockwise. */
const LANDSCAPE_TURN = 90;
const asPatch = (s: LabelSize) => ({ widthMm: s.widthMm, heightMm: s.heightMm, tailMm: s.tailMm, fold: s.fold });

/** A friendly first label, so the editor never opens blank. */
export function starterDoc(): LabelDoc {
  const doc = createDoc({ widthMm: 40, heightMm: 12 }, 'My label');
  doc.elements.push(createElement('text', doc, { text: 'Hello, label!' }));
  return doc;
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = src;
  });
}

interface Props {
  initialDoc: LabelDoc;
  initialProfileId: string | null;
  /** Undefined until the user picks one; the printer's default applies until then. */
  initialDensity?: number;
  initialRollSizes?: Record<string, LabelSize>;
  initialOffsets?: Record<string, PrintOffset>;
  initialStickerGaps?: StickerGaps;
  initialPaperWidths?: PaperWidths;
  initialLabelLengths?: LabelLengths;
  /** The app opens on the start screen; tests can start in the editor. */
  initialView?: 'start' | 'edit';
}

export function Editor({ initialDoc, initialProfileId, initialDensity, initialRollSizes = {}, initialOffsets = {}, initialStickerGaps = {}, initialPaperWidths = {}, initialLabelLengths = {}, initialView = 'edit' }: Props) {
  const [view, setView] = useState(initialView);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('mine');
  const [templateSeed, setTemplateSeed] = useState<TemplateSeed>({});
  const editor = useEditor(initialDoc);
  const { state, dispatch, selected, add, update, duplicate } = editor;
  const selection = useMemo(() => state.doc.elements.filter((el) => state.selectedIds.includes(el.id)), [state.doc.elements, state.selectedIds]);
  /** Copies of elements, 1 mm down and right, selected. */
  const copies = useCallback((els: LabelElement[]) => {
    // Copied groups become groups of their own.
    const groups = new Map(els.filter((el) => el.group).map((el) => [el.group!, uid()]));
    dispatch({
      type: 'addMany',
      elements: els.map((el) => ({ ...el, id: uid(), x: round1(el.x + 1), y: round1(el.y + 1), ...(el.group ? { group: groups.get(el.group) } : {}) })),
    });
  }, [dispatch]);
  const { doc } = state;
  const status = useSyncExternalStore(
    (fn) => printer.subscribe(fn),
    () => printer.getStatus(),
  );
  const [dialog, setDialog] = useState<DialogName>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [printPreview, setPrintPreview] = useState<string | null>(null);
  /** True while the preview is being drawn, so a loader can show over an old or missing one. */
  const [previewBusy, setPreviewBusy] = useState(false);
  /** The latest raster has dots the printhead cannot reach. */
  const [clipped, setClipped] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [fontsVersion, setFontsVersion] = useState(0);
  const [manualProfileId, setManualProfileId] = useState<string | null>(initialProfileId);
  const [savedDensity, setDensity] = useState(initialDensity);
  const fileHandle = useRef<FileHandle | null>(null);
  const clipboard = useRef<LabelElement[]>([]);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  /** Canvas zoom in screen pixels per millimetre; null fits the label to the view. */
  const [zoomLevel, setZoomLevel] = useState<number | null>(null);
  const [zoomRequest, setZoomRequest] = useState<{ dir: 'in' | 'out' | 'fit'; n: number } | null>(null);
  const requestZoom = (dir: 'in' | 'out' | 'fit') => setZoomRequest((r) => ({ dir, n: (r?.n ?? 0) + 1 }));
  /** The icon element the picker replaces; null adds a new one. */
  const [iconTarget, setIconTarget] = useState<string | null>(null);
  const dpi = status.profile?.dpi ?? DEFAULT_DPI;
  const density = savedDensity ?? status.profile?.densityDefault ?? 3;
  const [rollSizes, setRollSizes] = useState(initialRollSizes);
  const roll = resolveRoll(status.label, rollSizes);
  const appliedRoll = useRef<string | null>(null);
  const [offsets, setOffsets] = useState(initialOffsets);
  // Offsets belong to the printer model: each one's paper path sits a little differently.
  const printerKey = status.detectedModel ?? status.profile?.id ?? null;
  const offset = (printerKey && offsets[printerKey]) || { x: 0, y: 0 };
  const [stickerGaps, setStickerGaps] = useState(initialStickerGaps);
  /** Sticker rolls on a printer that cannot sense the gaps: the gap fed after each sticker. Unset is continuous paper. */
  const stickerGap = status.canFeed && printerKey ? stickerGaps[printerKey] : undefined;
  const [paperWidths, setPaperWidths] = useState(initialPaperWidths);
  /** What a continuous-paper printer prints across: its whole head, in whole mm. */
  const headWidth = status.profile?.kind === 'thermal' ? Math.floor(printheadMm(status.profile)) : THERMAL_HEAD_MM;
  /** The paper loaded on it: as wide as the head, unless set narrower (or wider) for this printer. */
  const paperWidth = (status.canFeed && printerKey && paperWidths[printerKey]) || headWidth;
  const [labelLengths, setLabelLengths] = useState(initialLabelLengths);
  /** The length new labels start at on a continuous-paper printer: set in the printer window or on the start screen. */
  const labelLength = (status.canFeed && printerKey && labelLengths[printerKey]) || THERMAL_DEFAULT_SIZE.heightMm;

  useEffect(() => printer.setManualProfile(initialProfileId), [initialProfileId]);

  // The printer a label is for: the one connected while it is made. The demo is no real printer.
  const connectedPrinter =
    (status.state === 'ready' || status.state === 'printing') && status.profile?.name !== DEMO_NAME
      ? (status.profile?.name ?? status.detectedModel)
      : undefined;
  useEffect(() => {
    if (view === 'edit' && connectedPrinter && !doc.printer) dispatch({ type: 'meta', patch: { printer: connectedPrinter } });
  }, [view, connectedPrinter, doc.printer, dispatch]);

  // The window title follows the open label.
  useEffect(() => {
    const base = document.title;
    if (view === 'edit') document.title = `${doc.name} · niimai`;
    return () => {
      document.title = base;
    };
  }, [view, doc.name]);

  // Autosave to the library.
  useEffect(() => {
    const t = setTimeout(() => {
      void saveLabel(doc).catch(() => {});
      void setSetting('lastLabelId', doc.id).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [doc]);

  // Match the label to the loaded roll, once per roll. Undo puts the old size back.
  const docSize: LabelSize = { widthMm: doc.widthMm, heightMm: doc.heightMm, tailMm: doc.tailMm, fold: doc.fold };
  // Where the label meets the paper; a landscape label's artboard is turned from it.
  const paper = paperSize(doc);
  const toPaper = (size: LabelSize) => onPaper(asPatch(size), doc.landscape);
  useEffect(() => {
    if (status.state === 'disconnected') appliedRoll.current = null;
    if (!roll.key || appliedRoll.current === roll.key) return;
    appliedRoll.current = roll.key;
    if (roll.size && !sameSize(roll.size, paper)) {
      dispatch({ type: 'setDoc', patch: toPaper(roll.size) });
      dispatch({ type: 'commit' });
      toast(`Label resized to the ${roll.size.widthMm} × ${roll.size.heightMm} mm roll`, {
        action: { label: 'Undo', onClick: () => dispatch({ type: 'undo' }) },
      });
    } else if (roll.needsSize) {
      // The printer cannot report this roll's size; ask now, once, and remember it.
      setDialog('roll');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll.key, roll.size?.widthMm, roll.size?.heightMm, status.state]);

  // A different label, or a new size, starts again fitted to the view.
  useEffect(() => setZoomLevel(null), [doc.id, doc.widthMm, doc.heightMm]);

  // What the printhead reaches. Borders past it print with sides missing, so they move inside once per border.
  const safe = doc.landscape ? turnedArea(safeArea(paper, status.profile), doc.heightMm) : safeArea(docSize, status.profile);
  // Details thinner than the printer's dots look crisp on screen but vanish on paper. Fonts change the text measurements.
  const issues = useMemo(() => printIssues(doc, dpi), [doc, dpi, fontsVersion]);

  // Dynamic fields: the canvas and previews show one record, a row of the sheet when there is one.
  const needs = batchNeeds(doc);
  const rowCount = needs.sheet ? doc.sheet!.rows.length : 1;
  const [recordIndex, setRecordIndex] = useState(0);
  const shownIndex = Math.min(recordIndex, rowCount - 1);
  const shownDoc = useMemo(() => resolveDoc(doc, { index: shownIndex, now: new Date() }), [doc, shownIndex]);
  const resolveShown = useCallback((el: LabelElement) => shownDoc.elements.find((e) => e.id === el.id) ?? el, [shownDoc]);
  useEffect(() => setRecordIndex(0), [doc.id, doc.sheet]);

  const addSheet = async () => {
    try {
      const opened = await openSheetFile();
      if (!opened) return;
      const sheet = await readSheetFile(opened.file);
      dispatch({ type: 'setDoc', patch: { sheet } });
      dispatch({ type: 'commit' });
      toast.success(`${sheet.rows.length} ${sheet.rows.length === 1 ? 'row' : 'rows'} from ${sheet.name}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const fittedBorders = useRef<string | null>(null);
  // Read before effects run: when the label is about to follow a new roll, wait for that size.
  const resizePending = !!roll.key && appliedRoll.current !== roll.key && !!roll.size && !sameSize(roll.size, paper);
  useEffect(() => {
    if (resizePending) return;
    const boxes = fitBorders(doc.elements, docSize, safe);
    const ids = Object.keys(boxes);
    if (!ids.length || !status.profile) return;
    const key = `${status.profile.id}:${doc.id}:${doc.widthMm}x${doc.heightMm}:${ids.sort().join(',')}`;
    if (fittedBorders.current === key) return;
    fittedBorders.current = key;
    for (const id of ids) dispatch({ type: 'update', id, patch: boxes[id], key: 'safe-area' });
    dispatch({ type: 'commit' });
    toast(ids.length > 1 ? 'Borders moved inside the printable area' : 'Border moved inside the printable area', {
      action: { label: 'Undo', onClick: () => ids.forEach(() => dispatch({ type: 'undo' })) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, status.profile?.id]);

  // Continuous-paper printers print 48 mm wide; offer to move a label of another width over, once per label and connection.
  const offeredContinuous = useRef<string | null>(null);
  useEffect(() => {
    if (status.state === 'disconnected') offeredContinuous.current = null;
    if (status.profile?.kind !== 'thermal' || view !== 'edit' || paper.widthMm === paperWidth) return;
    const key = `${status.profile.id}:${doc.id}`;
    if (offeredContinuous.current === key) return;
    offeredContinuous.current = key;
    setDialog((d) => d ?? 'continuous');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.state, status.profile?.id, doc.id, paper.widthMm, view, paperWidth]);

  const switchToContinuous = (size: LabelSize) => {
    dispatch({ type: 'setDoc', patch: { ...onPaper({ widthMm: size.widthMm, heightMm: size.heightMm }, doc.landscape), tailMm: undefined, fold: undefined, paper: undefined } });
    dispatch({ type: 'commit' });
  };

  /** Puts the design on the loaded roll: its size, and paper that follows the roll. */
  const matchRoll = () => {
    const patch = { ...(roll.size ? toPaper(roll.size) : {}), ...(doc.paper && status.label?.paper && doc.paper !== status.label.paper ? { paper: undefined } : {}) };
    dispatch({ type: 'setDoc', patch });
    dispatch({ type: 'commit' });
  };

  const saveRollSize = (size: LabelSize) => {
    const barcode = status.label?.barcode;
    if (!barcode) return;
    const next = { ...rollSizes, [barcode]: size };
    setRollSizes(next);
    void setSetting('rollSizes', next).catch(() => {});
    if (!sameSize(size, paper)) dispatch({ type: 'setDoc', patch: toPaper(size) });
  };

  // Fonts: link every family in use and re-measure text once they arrive.
  const fontKey = usedFonts(doc).join('|');
  useEffect(() => {
    fontKey.split('|').filter(Boolean).forEach((f) => void linkFont(f));
  }, [fontKey]);
  useEffect(() => {
    if (!document.fonts) return;
    const bump = () => setFontsVersion((v) => v + 1);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);

  // Images reduced to 1 bit at printer resolution, shown in the editor too.
  const imageKey = JSON.stringify(
    doc.elements.filter((e) => e.type === 'image').map((e) => (e.type === 'image' ? [e.id, e.src.length, e.src.slice(-32), e.w, e.h, e.dither, e.threshold, e.invert] : null)),
  );
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      processImages(doc, dpi).then(
        (imgs) => live && setImages(imgs),
        () => {},
      );
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey, dpi]);

  // The 1-bit raster for preview mode and the print dialog.
  const wantRaster = previewOn || dialog === 'print';
  useEffect(() => {
    if (!wantRaster) return;
    let live = true;
    setPreviewBusy(true);
    const t = setTimeout(() => {
      rasterize(shownDoc, dpi, images).then(
        (c) => {
          if (!live) return;
          // The canvas shows the label upright; the print window shows it the way it comes out of the printer.
          const out = shownDoc.landscape ? rotateCanvas(c, LANDSCAPE_TURN) : c;
          setPreview(c.toDataURL());
          setPrintPreview(out === c ? null : out.toDataURL());
          setPreviewBusy(false);
          const profile = printer.getStatus().profile;
          const data = profile && out.getContext('2d')?.getImageData(0, 0, out.width, out.height).data;
          setClipped(!!data && inkOutsideHead(data, out.width, out.height, profile!));
        },
        (err: Error) => {
          if (!live) return;
          setPreviewBusy(false);
          toast.error(err.message);
        },
      );
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [wantRaster, shownDoc, dpi, images, fontsVersion, status.profile?.id]);

  const loadDoc = useCallback(
    (next: LabelDoc, handle: FileHandle | null = null) => {
      fileHandle.current = handle;
      dispatch({ type: 'load', doc: next });
      setView('edit');
    },
    [dispatch],
  );

  // Share links carry a label in the address; opening one opens a copy of that label.
  useEffect(() => {
    const openShared = () => {
      const part = sharedPart(window.location.hash);
      if (!part) return;
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
      decodeShare(part)
        .then((shared) => {
          loadDoc(shared);
          toast.success(`Opened ${shared.name}`);
        })
        .catch(() => toast.error('This share link is damaged or cut short'));
    };
    openShared();
    window.addEventListener('hashchange', openShared);
    return () => window.removeEventListener('hashchange', openShared);
  }, [loadDoc]);

  const addImage = useCallback(
    async (file: Blob, replaceId?: string) => {
      const svg = isSvgFile(file);
      const src = await readAsDataUrl(svg ? asSvgBlob(file) : file);
      // SVGs sized only by a viewBox load at 0 × 0, so read their proportions from the markup.
      const { w, h } = (svg && svgSize(await file.text())) || (await imageSize(src));
      // Line art prints crisper with a plain threshold.
      const look = svg ? { dither: 'threshold' as const } : {};
      if (replaceId) {
        update(replaceId, { src, ...look });
        return;
      }
      const max = Math.min(doc.widthMm, doc.heightMm) * 0.9;
      const scale = max / Math.max(w, h);
      const ew = round1(w * scale);
      const eh = round1(h * scale);
      add('image', { src, ...look, w: ew, h: eh, x: round1((doc.widthMm - ew) / 2), y: round1((doc.heightMm - eh) / 2) });
    },
    [add, update, doc.widthMm, doc.heightMm],
  );

  const chooseImage = useCallback(
    async (replaceId?: string) => {
      try {
        const opened = await openImageFile();
        if (opened) await addImage(opened.file, replaceId);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [addImage],
  );

  const onAdd = (type: ElementType, extra?: Partial<LabelElement>) => {
    if (type === 'image') void chooseImage();
    else if (type === 'icon') {
      setIconTarget(null);
      setDialog('icon');
    } else {
      const el = add(type, extra);
      if (type === 'text') setEditing({ id: el.id });
    }
  };

  const pickIcon = ({ name, weight, body }: PickedIcon) => {
    if (iconTarget) update(iconTarget, { name, weight, body });
    else add('icon', { name, weight, body });
  };

  /** Leaves in-place editing; a text element left empty is removed. */
  const endEditing = () => {
    if (!editing) return;
    const el = doc.elements.find((e) => e.id === editing.id);
    setEditing(null);
    if (el?.type === 'text' && !el.text.trim()) dispatch({ type: 'remove', id: el.id });
    else dispatch({ type: 'commit' });
  };

  const save = useCallback(
    async (as = false) => {
      // Saving records the printer in use; once saved, the label takes the file's name.
      const printerPatch = connectedPrinter ? { printer: connectedPrinter } : {};
      const named = (fileName: string) => dispatch({ type: 'meta', patch: { name: fileName, fileName, ...printerPatch } });
      const text = (name: string) => serializeDoc({ ...doc, ...printerPatch, name, fileName: name });
      if (!as && fileHandle.current && (await writeToHandle(fileHandle.current, text(baseName(fileHandle.current.name))))) {
        named(baseName(fileHandle.current.name));
        toast.success(`Saved ${fileHandle.current.name}`);
        return;
      }
      const suggested = safeFileName(doc.name);
      const outcome = await saveTextAs(`${suggested}${LABEL_EXT}`, text(suggested));
      if (outcome.status === 'saved') {
        fileHandle.current = outcome.handle;
        named(baseName(outcome.handle.name));
        toast.success(`Saved ${outcome.handle.name}`);
      } else if (outcome.status === 'downloaded') {
        named(suggested);
        toast.success('Downloaded');
      } else if (outcome.status === 'failed') toast.error(outcome.reason);
    },
    [doc, connectedPrinter, dispatch],
  );

  const open = useCallback(async () => {
    try {
      const opened = await openLabelFile();
      if (!opened) return;
      const fileName = baseName(opened.name);
      loadDoc({ ...parseDoc(JSON.parse(await opened.file.text())), name: fileName, fileName }, opened.handle ?? null);
    } catch (err) {
      toast.error(err instanceof SyntaxError ? 'Not a label file' : (err as Error).message);
    }
  }, [loadDoc]);

  const createNew = (size: LabelSize) => loadDoc(createDoc(size));

  const openTemplates = (seed: TemplateSeed = {}) => {
    setTemplateSeed(seed);
    setLibraryTab('templates');
    setDialog('library');
  };

  /** The labels a print covers: one, or a run of records for dynamic fields. */
  const recordsFor = (batch?: BatchRun): LabelDoc[] | null => {
    if (!batch) return null;
    const now = new Date();
    return Array.from({ length: batch.count }, (_, i) => resolveDoc(doc, { index: batch.first + i, now }));
  };

  /**
   * What the label prints on. Printers that cannot sense the paper print on
   * continuous paper unless the printer is set to stickers, which feed the
   * rest of the sticker and the gap after each one. printedMm is the
   * printed length along the paper.
   */
  const paperFor = (printedMm = paper.heightMm): { labelType: number; gapMm?: number } => {
    if (!status.canFeed) return { labelType: labelTypeOf(effectivePaper(doc.paper, status.label?.paper)) };
    return stickerGap === undefined ? { labelType: labelTypeOf('continuous') } : { labelType: labelTypeOf('gaps'), gapMm: stickerFeed(stickerGap, labelLength, printedMm) };
  };

  /** The test labels' size: the paper set for printers that cannot sense it, else the roll. */
  const testSize = (): LabelSize => (status.canFeed ? { widthMm: paperWidth, heightMm: labelLength } : (roll.size ?? paper));

  /**
   * A page and the options that place it. Printers that cannot sense the
   * paper get the label turned and set on a canvas as wide as the head, so
   * the sideways offset moves the whole label along the head.
   */
  const onHead = status.canFeed && status.profile ? status.profile.printheadPixels : null;
  const placePage = (page: HTMLCanvasElement, turn: Rotation = 0): HTMLCanvasElement =>
    onHead === null ? page : placeOnHead(turn ? rotateCanvas(page, turn) : page, onHead, (offset.x * dpi) / 25.4);
  const placement = (turn: Rotation = 0): Pick<PrintOptions, 'offset' | 'rotate'> =>
    onHead === null ? { offset, ...(turn ? { rotate: turn } : {}) } : { offset: { x: 0, y: offset.y } };

  const printToPrinter = async (copies: number, batch?: BatchRun) => {
    try {
      const { labelType, gapMm } = paperFor();
      const now = new Date();
      const turn: Rotation = doc.landscape ? LANDSCAPE_TURN : 0;
      const page = async (i: number) => placePage(await rasterize(resolveDoc(doc, { index: i, now }), dpi, images), turn);
      const source = batch ? { count: batch.count, page: (i: number) => page(batch.first + i) } : await page(shownIndex);
      await printer.print(source, { density, copies, labelType, gapMm, ...placement(turn) });
      const total = copies * (batch?.count ?? 1);
      toast.success(total > 1 ? `Printed ${total} labels` : 'Printed');
      void recordPrint(doc, total).catch(() => {});
      // A run of numbers continues where it stopped next time.
      if (batch && !needs.sheet && needs.number) {
        const seq = { start: 1, step: 1, digits: 1, ...doc.sequence };
        const shift = (batch.first + batch.count) * seq.step;
        // A set range moves along whole, so the next run is the same length.
        const next = { ...seq, start: seq.start + shift, ...(seq.end !== undefined ? { end: seq.end + shift } : {}) };
        dispatch({ type: 'setDoc', patch: { sequence: next } });
        dispatch({ type: 'commit' });
        toast(`Numbers continue from ${next.start}`, { action: { label: 'Undo', onClick: () => dispatch({ type: 'undo' }) } });
      }
      setDialog(null);
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  };

  const printFromBrowser = async (copies: number, batch?: BatchRun) => {
    try {
      // Original images: an office printer can reproduce more than the thermal head.
      const records = recordsFor(batch);
      browserPrint(doc, records ? await standaloneSvgs(records) : await standaloneSvg(shownDoc, dpi, {}), copies);
      void recordPrint(doc, copies * (batch?.count ?? 1)).catch(() => {});
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  };

  /** Opens a past print, as it printed; again opens the print window for it. */
  const openPrint = async (record: PrintRecord, again: boolean) => {
    const newest = record.doc.id === doc.id ? doc : await getLabel(record.doc.id).catch(() => undefined);
    const next = printedDoc(record, newest);
    // The open label, unchanged since it printed, stays open with its undo history.
    if (next !== record.doc || newest !== doc) loadDoc(next);
    else setView('edit');
    if (again) setDialog('print');
  };

  /** Prints the alignment test label on the loaded roll, with the current offset. */
  const printAlignmentTest = async () => {
    try {
      const test = alignmentDoc(testSize());
      const page = placePage(await rasterize(test, dpi, {}));
      await printer.print(page, { density, copies: 1, ...placement(), ...paperFor(test.heightMm) });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  /**
   * Prints the sticker scale across the whole head, from wherever the paper
   * sits, with nothing fed after it: the paper stops at the scale's end.
   * Resolves to the printed length.
   */
  const printStickerScale = async (about: number) => {
    const length = scaleLength(about, stickerGap ?? 0);
    const canvas = await rasterize(scaleDoc(headWidth, length), dpi, {});
    await printer.print(canvas, { density, copies: 1, offset: { x: 0, y: 0 }, labelType: labelTypeOf('gaps'), gapMm: 0 });
    return length;
  };

  const connect = async (kind: ConnectionKind) => {
    await printer.connect(kind);
    const s = printer.getStatus();
    toast.success(`Connected to ${s.deviceName ?? 'printer'}`);
  };

  /** Sets the printer's sticker gap; null goes back to continuous paper. */
  const changeStickerGap = (gap: number | null) => {
    if (!printerKey) return;
    const { [printerKey]: _, ...rest } = stickerGaps;
    const all = gap === null ? rest : { ...rest, [printerKey]: gap };
    setStickerGaps(all);
    void setSetting('stickerGaps', all).catch(() => {});
  };

  /** Sets the printer's paper width; the head's own width clears it. */
  const changePaperWidth = (width: number) => {
    if (!printerKey) return;
    const { [printerKey]: _, ...rest } = paperWidths;
    const all = width === headWidth ? rest : { ...rest, [printerKey]: width };
    setPaperWidths(all);
    void setSetting('paperWidths', all).catch(() => {});
  };

  const changeLabelLength = (length: number) => {
    if (!printerKey) return;
    const all = { ...labelLengths, [printerKey]: length };
    setLabelLengths(all);
    void setSetting('labelLengths', all).catch(() => {});
  };

  const changeOffset = (next: PrintOffset) => {
    if (!printerKey) return;
    const all = { ...offsets, [printerKey]: next };
    setOffsets(all);
    void setSetting('printOffsets', all).catch(() => {});
  };

  const chooseProfile = (id: string | null) => {
    setManualProfileId(id);
    printer.setManualProfile(id);
    void setSetting('manualProfileId', id).catch(() => {});
  };

  const changeDensity = (d: number) => {
    setDensity(d);
    void setSetting('density', d).catch(() => {});
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const hit = matchShortcut(e);
      if (!hit || hit.action === 'paste') return;
      // The start screen hides the label, so only shortcuts that leave it apply there.
      if (view === 'start' && !['new', 'open', 'library'].includes(hit.action)) return;
      e.preventDefault();
      const sel = selected;
      const all = selection;
      switch (hit.action) {
        case 'new':
          return setDialog('new');
        case 'open':
          return void open();
        case 'save':
          return void save();
        case 'saveAs':
          return void save(true);
        case 'print':
          return setDialog('print');
        case 'library':
          setLibraryTab('mine');
          return setDialog('library');
        case 'zoomIn':
          return requestZoom('in');
        case 'zoomOut':
          return requestZoom('out');
        case 'zoomFit':
          return requestZoom('fit');
        case 'preview':
          return setPreviewOn((p) => !p);
        case 'undo':
          return dispatch({ type: 'undo' });
        case 'redo':
          return dispatch({ type: 'redo' });
        case 'deselect':
          return dispatch({ type: 'select', id: null });
        case 'edit':
          if (sel?.type === 'text') setEditing({ id: sel.id });
          return;
        case 'selectAll':
          return dispatch({ type: 'selectMany', ids: doc.elements.filter((el) => !el.locked).map((el) => el.id) });
        case 'group':
          return dispatch({ type: 'group', ids: all.map((el) => el.id) });
        case 'ungroup':
          return dispatch({ type: 'ungroup', ids: all.map((el) => el.id) });
        case 'lock':
          return dispatch({ type: 'lock', ids: all.map((el) => el.id), locked: true });
        case 'copy':
          if (all.length) clipboard.current = all;
          return;
        case 'cut':
          if (all.length) {
            clipboard.current = all;
            dispatch({ type: 'removeMany', ids: all.map((el) => el.id) });
          }
          return;
        case 'duplicate':
          if (all.length) copies(all);
          return;
        case 'delete':
          if (all.length) dispatch({ type: 'removeMany', ids: all.map((el) => el.id) });
          return;
        case 'nudge':
          if (all.length)
            dispatch({
              type: 'updateMany',
              patches: Object.fromEntries(all.map((el) => [el.id, { x: round1(el.x + (hit.dx ?? 0)), y: round1(el.y + (hit.dy ?? 0)) }])),
              key: 'nudge',
            });
          return;
      }
    };
    // Paste comes through the paste event, which also carries images from other apps.
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA'].includes(t.tagName))) return;
      const file = [...(e.clipboardData?.files ?? [])].find(isImageFile);
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (file) {
        e.preventDefault();
        void addImage(file);
      } else if (looksLikeSvg(text)) {
        e.preventDefault();
        void addImage(new Blob([text], { type: 'image/svg+xml' }));
      } else if (clipboard.current.length) {
        e.preventDefault();
        copies(clipboard.current);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [selected, selection, copies, doc.elements, open, save, dispatch, addImage, view]);

  const onDrop = (e: DragEvent) => {
    const file = [...e.dataTransfer.files].find(isImageFile);
    if (!file) return;
    e.preventDefault();
    void addImage(file);
  };

  return (
    <div className="app">
      <ErrorBoundary name="Toolbar">
        <Header
          name={doc.name}
          fileName={doc.fileName}
          docPrinter={doc.printer}
          onRename={(name) => dispatch({ type: 'setDoc', patch: { name } })}
          onSaveAs={() => void save(true)}
          canUndo={state.past.length > 0}
          canRedo={state.future.length > 0}
          preview={previewOn}
          printer={status}
          home={view === 'start'}
          onHome={() => setView('start')}
          onAction={(a) => {
            if (a === 'open') void open();
            else if (a === 'save') void save();
            else if (a === 'undo' || a === 'redo') dispatch({ type: a });
            else if (a === 'preview') setPreviewOn((p) => !p);
            else if (a === 'templates') openTemplates();
            else {
              if (a === 'library') setLibraryTab('mine');
              setDialog(a);
            }
          }}
        />
      </ErrorBoundary>
      {view === 'start' ? (
        <ErrorBoundary name="Start">
          <StartScreen
            status={status}
            roll={roll}
            stickerGap={stickerGap}
            paperWidth={paperWidth}
            labelLength={labelLength}
            onLabelLength={changeLabelLength}
            defaultSize={{ widthMm: paper.widthMm, heightMm: paper.heightMm }}
            onConnect={connect}
            printerType={manualProfileId}
            onSetRollSize={() => setDialog('roll')}
            onPrinterSettings={() => setDialog('printer')}
            // The label still in memory reopens as it is, keeping its undo history.
            onOpen={(d) => (d.id === doc.id ? setView('edit') : loadDoc(d))}
            onBlank={(size) => loadDoc(createDoc(size))}
            onBrowseTemplates={openTemplates}
          />
        </ErrorBoundary>
      ) : (
      <div className="workspace">
        <ErrorBoundary name="Tools">
          <AddBar onAdd={onAdd} />
        </ErrorBoundary>
        <main className="stage" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <RollMismatchBanner className="stage-banner" doc={doc} rollSize={roll.size} rollPaper={status.label?.paper} onMatch={matchRoll} />
          {previewOn && previewBusy && (
            <div className="stage-loader" role="status" aria-label="Drawing preview">
              <Loader2 size={16} className="spin" />
            </div>
          )}
          <ErrorBoundary name="Canvas" resetKeys={[doc]}>
            <Canvas
              doc={doc}
              selectedIds={state.selectedIds}
              dispatch={dispatch}
              images={images}
              preview={previewOn ? preview : null}
              fontsVersion={fontsVersion}
              editingId={editing?.id ?? null}
              onEditStart={(id) => {
                dispatch({ type: 'select', id });
                setEditing({ id });
              }}
              onEditEnd={endEditing}
              safeArea={safe}
              issues={issues}
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
              zoomRequest={zoomRequest}
              resolve={resolveShown}
              record={needs.sheet ? { index: shownIndex, count: rowCount, onChange: setRecordIndex } : null}
            />
          </ErrorBoundary>
          {doc.elements.length === 0 && !previewOn && (
            <button className="stage-templates" onClick={() => openTemplates()}>
              <LayoutTemplate size={16} /> Start from one of {TEMPLATES.length.toLocaleString()} templates
            </button>
          )}
        </main>
        <ErrorBoundary name="Inspector" resetKeys={[state.selectedIds.join()]}>
          <Inspector
            doc={{ ...doc, ...paper }}
            selected={selected}
            selection={selection}
            onUpdateMany={(patches) => {
              dispatch({ type: 'updateMany', patches });
              dispatch({ type: 'commit' });
            }}
            onRemoveMany={(ids) => dispatch({ type: 'removeMany', ids })}
            onDuplicateMany={copies}
            onGroup={(ids) => dispatch({ type: 'group', ids })}
            onUngroup={(ids) => dispatch({ type: 'ungroup', ids })}
            onLock={(ids, locked) => dispatch({ type: 'lock', ids, locked })}
            onSelectAll={() => dispatch({ type: 'selectMany', ids: doc.elements.filter((el) => !el.locked).map((el) => el.id) })}
            roll={roll}
            rollPaper={status.label?.paper}
            fitting={status.profile ? sizesForPrinter(status.profile) : []}
            allSizes={allSizesFor(null)}
            onSetRollSize={() => setDialog('roll')}
            onUpdate={update}
            onTurn={() => {
              dispatch({ type: 'setDoc', patch: turnPatch(doc) });
              dispatch({ type: 'commit' });
            }}
            onDocChange={(patch) => {
              // On paper the printer cannot sense, the length set here is the paper's, and the printer keeps it.
              if (status.canFeed && patch.heightMm !== undefined && !('widthMm' in patch)) changeLabelLength(patch.heightMm);
              // The panel shows the paper's size; a landscape artboard takes it turned.
              const { widthMm, heightMm, tailMm, fold, ...rest } = patch;
              const size = 'widthMm' in patch && 'heightMm' in patch ? asPatch(patch as LabelSize) : Object.fromEntries(Object.entries({ widthMm, heightMm, tailMm, fold }).filter(([k]) => k in patch));
              dispatch({ type: 'setDoc', patch: { ...rest, ...onPaper(size, doc.landscape) } });
            }}
            onDuplicate={duplicate}
            onRemove={(id) => dispatch({ type: 'remove', id })}
            onReorder={(id, direction) => dispatch({ type: 'reorder', id, direction })}
            onReplaceImage={(id) => void chooseImage(id)}
            onEditText={(id) => setEditing({ id })}
            printIssue={selected ? issues[selected.id] : null}
            continuous={status.profile?.kind === 'thermal'}
            stickerGap={stickerGap}
            paperWidth={paperWidth}
            onAddSheet={() => void addSheet()}
            resolve={resolveShown}
            onReplaceIcon={(id) => {
              setIconTarget(id);
              setDialog('icon');
            }}
          />
        </ErrorBoundary>
      </div>
      )}

      <SizeDialog
        key={dialog === 'new' ? 'new' : 'new-closed'}
        open={dialog === 'new'}
        onOpenChange={(o) => setDialog(o ? 'new' : null)}
        title="New label"
        actionLabel="Create"
        // On paper the printer cannot sense, the paper set for it comes first, then common lengths at its width.
        rollSize={roll.size ?? (status.canFeed ? { widthMm: paperWidth, heightMm: labelLength } : null)}
        presets={status.canFeed ? THERMAL_SIZES.map((s) => ({ widthMm: paperWidth, heightMm: s.heightMm })) : undefined}
        onPick={createNew}
      />
      <ContinuousDialog
        open={dialog === 'continuous'}
        onOpenChange={(o) => setDialog(o ? 'continuous' : null)}
        printerName={status.profile?.name ?? 'This printer'}
        current={paper}
        widthMm={paperWidth}
        onSwitch={switchToContinuous}
      />
      <SizeDialog
        key={dialog === 'roll' ? 'roll' : 'roll-closed'}
        open={dialog === 'roll'}
        onOpenChange={(o) => setDialog(o ? 'roll' : null)}
        title="What size is this roll?"
        description={`${status.profile?.name ?? 'This printer'} does not report it. niimai remembers it for this ${roll.manual ? 'printer' : 'roll'}.`}
        actionLabel="Remember size"
        rollSize={null}
        initial={roll.size ?? sizesForPrinter(status.profile)[0] ?? paper}
        presets={sizesForPrinter(status.profile)}
        onPick={saveRollSize}
      />
      <IconPicker
        open={dialog === 'icon'}
        onOpenChange={(o) => setDialog(o ? 'icon' : null)}
        weight={(selected?.type === 'icon' && iconTarget ? selected.weight : null) ?? 'bold'}
        onPick={pickIcon}
      />
      <ShareDialog open={dialog === 'share'} onOpenChange={(o) => setDialog(o ? 'share' : null)} doc={doc} />
      <LibraryDialog
        open={dialog === 'library'}
        onOpenChange={(o) => setDialog(o ? 'library' : null)}
        currentId={doc.id}
        currentSize={roll.size ?? paper}
        initialTab={libraryTab}
        templateSeed={templateSeed}
        continuous={status.profile?.kind === 'thermal'}
        onOpen={(d) => loadDoc(d)}
        onOpenPrint={(record, again) => void openPrint(record, again)}
      />
      <PrintDialog
        open={dialog === 'print'}
        onOpenChange={(o) => setDialog(o ? 'print' : null)}
        doc={doc}
        status={status}
        preview={printPreview ?? preview}
        previewBusy={previewBusy}
        density={density}
        onDensity={changeDensity}
        onPrint={printToPrinter}
        onBrowserPrint={printFromBrowser}
        onAddSheet={() => void addSheet()}
        onSequence={(sequence) => dispatch({ type: 'setDoc', patch: { sequence } })}
        onConnect={() => setDialog('printer')}
        rollSize={roll.size}
        rollName={roll.name}
        stickerGap={stickerGap}
        onMatchRoll={matchRoll}
        clipped={clipped}
        issueCount={Object.keys(issues).length}
      />
      <PrinterDialog
        open={dialog === 'printer'}
        onOpenChange={(o) => setDialog(o ? 'printer' : null)}
        status={status}
        rollSize={roll.size}
        rollNeedsSize={roll.needsSize}
        rollManual={roll.manual}
        rollName={roll.name}
        onSetRollSize={() => setDialog('roll')}
        manualProfileId={manualProfileId}
        onConnect={connect}
        onAlignmentTest={printAlignmentTest}
        onStickerTest={printStickerScale}
        offset={offset}
        onOffset={changeOffset}
        onFeed={(mm) => printer.feed(mm)}
        stickerGap={stickerGap}
        onStickerGap={changeStickerGap}
        paperWidth={paperWidth}
        headWidth={headWidth}
        onPaperWidth={changePaperWidth}
        labelLength={labelLength}
        onLabelLength={changeLabelLength}
        onDisconnect={() => printer.disconnect()}
        onManualProfile={chooseProfile}
      />
    </div>
  );
}

/** Loads the last label and saved settings, then shows the editor. */
export function EditorLoader() {
  const [boot, setBoot] = useState<Props | null>(null);
  useEffect(() => {
    (async () => {
      let doc: LabelDoc | undefined;
      let profileId: string | null = null;
      let density: number | undefined;
      let rollSizes: Record<string, LabelSize> = {};
      let offsets: Record<string, PrintOffset> = {};
      let stickerGaps: StickerGaps = {};
      let paperWidths: PaperWidths = {};
      let labelLengths: LabelLengths = {};
      try {
        const lastId = await getSetting('lastLabelId');
        if (lastId) doc = await getLabel(lastId);
        profileId = (await getSetting('manualProfileId')) ?? null;
        density = await getSetting('density');
        rollSizes = (await getSetting('rollSizes')) ?? {};
        offsets = (await getSetting('printOffsets')) ?? {};
        stickerGaps = (await getSetting('stickerGaps')) ?? {};
        paperWidths = (await getSetting('paperWidths')) ?? {};
        labelLengths = (await getSetting('labelLengths')) ?? {};
      } catch {
        // Private windows can block IndexedDB; the editor still works without it.
      }
      setBoot({ initialDoc: doc ?? starterDoc(), initialProfileId: profileId, initialDensity: density, initialRollSizes: rollSizes, initialOffsets: offsets, initialStickerGaps: stickerGaps, initialPaperWidths: paperWidths, initialLabelLengths: labelLengths });
    })();
  }, []);
  if (!boot) return <div className="app-loading" aria-busy="true" />;
  return <Editor {...boot} initialView="start" />;
}
