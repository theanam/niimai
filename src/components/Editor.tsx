import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from 'react';
import { toast } from 'sonner';
import { createDoc, createElement, parseDoc, serializeDoc, usedFonts, type ElementType, type LabelDoc, type LabelElement, type LabelSize } from '../doc/model';
import { useEditor } from '../doc/useEditor';
import { LABEL_EXT, openImageFile, openLabelFile, readAsDataUrl, safeFileName, saveTextAs, writeToHandle, type FileHandle } from '../files/fs-access';
import { round1, uid } from '../lib/units';
import { printer } from '../printer';
import type { ConnectionKind } from '../printer/client';
import { effectivePaper, labelTypeOf } from '../printer/paper';
import { allSizesFor, resolveRoll, sameSize, sizesForPrinter } from '../printer/roll';
import { browserPrint } from '../render/browserPrint';
import { linkFont } from '../render/fonts';
import { processImages, rasterize, standaloneSvg } from '../render/raster';
import { matchShortcut } from '../shortcuts/shortcuts';
import { getLabel, getSetting, saveLabel, setSetting } from '../storage/db';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { AddBar } from './AddBar';
import { Canvas } from './Canvas';
import { Header } from './Header';
import { Inspector } from './Inspector';
import { IconPicker, type PickedIcon } from './IconPicker';
import { LibraryDialog } from './LibraryDialog';
import { SizeDialog } from './SizeDialog';
import { StartScreen } from './StartScreen';
import { PrintDialog } from './PrintDialog';
import { PrinterDialog } from './PrinterDialog';

type DialogName = 'new' | 'roll' | 'library' | 'print' | 'printer' | 'icon' | null;

const DEFAULT_DPI = 203;

/** A size as a document patch; always sets the tail, so a plain size clears a cable label's tail. */
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
  /** The app opens on the start screen; tests can start in the editor. */
  initialView?: 'start' | 'edit';
}

export function Editor({ initialDoc, initialProfileId, initialDensity, initialRollSizes = {}, initialView = 'edit' }: Props) {
  const [view, setView] = useState(initialView);
  const [libraryTab, setLibraryTab] = useState<'mine' | 'templates'>('mine');
  const editor = useEditor(initialDoc);
  const { state, dispatch, selected, add, update, duplicate } = editor;
  const { doc } = state;
  const status = useSyncExternalStore(
    (fn) => printer.subscribe(fn),
    () => printer.getStatus(),
  );
  const [dialog, setDialog] = useState<DialogName>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [fontsVersion, setFontsVersion] = useState(0);
  const [manualProfileId, setManualProfileId] = useState<string | null>(initialProfileId);
  const [savedDensity, setDensity] = useState(initialDensity);
  const fileHandle = useRef<FileHandle | null>(null);
  const clipboard = useRef<LabelElement | null>(null);
  const [editing, setEditing] = useState<{ id: string; fresh: boolean } | null>(null);
  /** The icon element the picker replaces; null adds a new one. */
  const [iconTarget, setIconTarget] = useState<string | null>(null);
  const dpi = status.profile?.dpi ?? DEFAULT_DPI;
  const density = savedDensity ?? status.profile?.densityDefault ?? 3;
  const [rollSizes, setRollSizes] = useState(initialRollSizes);
  const roll = resolveRoll(status.label, rollSizes);
  const appliedRoll = useRef<string | null>(null);

  useEffect(() => printer.setManualProfile(initialProfileId), [initialProfileId]);

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
  useEffect(() => {
    if (status.state === 'disconnected') appliedRoll.current = null;
    if (!roll.key || appliedRoll.current === roll.key) return;
    appliedRoll.current = roll.key;
    if (roll.size && !sameSize(roll.size, docSize)) {
      dispatch({ type: 'setDoc', patch: asPatch(roll.size) });
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

  const saveRollSize = (size: LabelSize) => {
    const barcode = status.label?.barcode;
    if (!barcode) return;
    const next = { ...rollSizes, [barcode]: size };
    setRollSizes(next);
    void setSetting('rollSizes', next).catch(() => {});
    if (!sameSize(size, docSize)) dispatch({ type: 'setDoc', patch: asPatch(size) });
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
    const t = setTimeout(() => {
      rasterize(doc, dpi, images).then(
        (c) => live && setPreview(c.toDataURL()),
        (err: Error) => live && toast.error(err.message),
      );
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [wantRaster, doc, dpi, images, fontsVersion]);

  const loadDoc = useCallback(
    (next: LabelDoc, handle: FileHandle | null = null) => {
      fileHandle.current = handle;
      dispatch({ type: 'load', doc: next });
      setView('edit');
    },
    [dispatch],
  );

  const addImage = useCallback(
    async (file: Blob, replaceId?: string) => {
      const src = await readAsDataUrl(file);
      const { w, h } = await imageSize(src);
      if (replaceId) {
        update(replaceId, { src });
        return;
      }
      const max = Math.min(doc.widthMm, doc.heightMm) * 0.9;
      const scale = max / Math.max(w, h);
      const ew = round1(w * scale);
      const eh = round1(h * scale);
      add('image', { src, w: ew, h: eh, x: round1((doc.widthMm - ew) / 2), y: round1((doc.heightMm - eh) / 2) });
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

  const onAdd = (type: ElementType) => {
    if (type === 'image') void chooseImage();
    else if (type === 'icon') {
      setIconTarget(null);
      setDialog('icon');
    } else {
      const el = add(type);
      if (type === 'text') setEditing({ id: el.id, fresh: true });
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
      const text = serializeDoc(doc);
      if (!as && fileHandle.current && (await writeToHandle(fileHandle.current, text))) {
        toast.success(`Saved ${fileHandle.current.name}`);
        return;
      }
      const outcome = await saveTextAs(`${safeFileName(doc.name)}${LABEL_EXT}`, text);
      if (outcome.status === 'saved') {
        fileHandle.current = outcome.handle;
        toast.success(`Saved ${outcome.handle.name}`);
      } else if (outcome.status === 'downloaded') toast.success('Downloaded');
      else if (outcome.status === 'failed') toast.error(outcome.reason);
    },
    [doc],
  );

  const open = useCallback(async () => {
    try {
      const opened = await openLabelFile();
      if (!opened) return;
      loadDoc(parseDoc(JSON.parse(await opened.file.text())), opened.handle ?? null);
    } catch (err) {
      toast.error(err instanceof SyntaxError ? 'Not a label file' : (err as Error).message);
    }
  }, [loadDoc]);

  const createNew = (size: LabelSize) => loadDoc(createDoc(size));

  const printToPrinter = async (copies: number) => {
    try {
      const canvas = await rasterize(doc, dpi, images);
      await printer.print(canvas, { density, copies, labelType: labelTypeOf(effectivePaper(doc.paper, status.label?.paper)) });
      toast.success(copies > 1 ? `Printed ${copies} labels` : 'Printed');
      setDialog(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const printFromBrowser = async (copies: number) => {
    try {
      // Original images: an office printer can reproduce more than the thermal head.
      browserPrint(doc, await standaloneSvg(doc, dpi, {}), copies);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const connect = async (kind: ConnectionKind) => {
    await printer.connect(kind);
    const s = printer.getStatus();
    toast.success(`Connected to ${s.deviceName ?? 'printer'}`);
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
        case 'preview':
          return setPreviewOn((p) => !p);
        case 'undo':
          return dispatch({ type: 'undo' });
        case 'redo':
          return dispatch({ type: 'redo' });
        case 'deselect':
          return dispatch({ type: 'select', id: null });
        case 'edit':
          if (sel?.type === 'text') setEditing({ id: sel.id, fresh: false });
          return;
        case 'copy':
          if (sel) clipboard.current = sel;
          return;
        case 'cut':
          if (sel) {
            clipboard.current = sel;
            dispatch({ type: 'remove', id: sel.id });
          }
          return;
        case 'duplicate':
          if (sel) duplicate(sel);
          return;
        case 'delete':
          if (sel) dispatch({ type: 'remove', id: sel.id });
          return;
        case 'nudge':
          if (sel) update(sel.id, { x: round1(sel.x + (hit.dx ?? 0)), y: round1(sel.y + (hit.dy ?? 0)) }, 'nudge');
          return;
      }
    };
    // Paste comes through the paste event, which also carries images from other apps.
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA'].includes(t.tagName))) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void addImage(file);
      } else if (clipboard.current) {
        e.preventDefault();
        const el = clipboard.current;
        dispatch({ type: 'add', element: { ...el, id: uid(), x: round1(el.x + 1), y: round1(el.y + 1) } });
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [selected, open, save, dispatch, duplicate, update, addImage, view]);

  const onDrop = (e: DragEvent) => {
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    void addImage(file);
  };

  return (
    <div className="app">
      <ErrorBoundary name="Toolbar">
        <Header
          name={doc.name}
          onRename={(name) => dispatch({ type: 'setDoc', patch: { name } })}
          canUndo={state.past.length > 0}
          canRedo={state.future.length > 0}
          preview={previewOn}
          printer={status}
          onHome={() => setView('start')}
          onAction={(a) => {
            if (a === 'open') void open();
            else if (a === 'save') void save();
            else if (a === 'undo' || a === 'redo') dispatch({ type: a });
            else if (a === 'preview') setPreviewOn((p) => !p);
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
            current={doc}
            onConnect={async (kind) => {
              await printer.connect(kind);
              toast.success(`Connected to ${printer.getStatus().deviceName ?? 'printer'}`);
            }}
            onSetRollSize={() => setDialog('roll')}
            onOpen={(d) => loadDoc(d)}
            onBlank={(size) => loadDoc(createDoc(size))}
            onBrowseTemplates={() => {
              setLibraryTab('templates');
              setDialog('library');
            }}
            onContinue={() => setView('edit')}
          />
        </ErrorBoundary>
      ) : (
      <div className="workspace">
        <ErrorBoundary name="Tools">
          <AddBar onAdd={onAdd} />
        </ErrorBoundary>
        <main className="stage" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <ErrorBoundary name="Canvas" resetKeys={[doc]}>
            <Canvas
              doc={doc}
              selectedId={state.selectedId}
              dispatch={dispatch}
              images={images}
              preview={previewOn ? preview : null}
              fontsVersion={fontsVersion}
              editingId={editing?.id ?? null}
              editingFresh={editing?.fresh ?? false}
              onEditStart={(id) => {
                dispatch({ type: 'select', id });
                setEditing({ id, fresh: false });
              }}
              onEditEnd={endEditing}
            />
          </ErrorBoundary>
        </main>
        <ErrorBoundary name="Inspector" resetKeys={[state.selectedId]}>
          <Inspector
            doc={doc}
            selected={selected}
            roll={roll}
            rollPaper={status.label?.paper}
            fitting={status.profile ? sizesForPrinter(status.profile) : []}
            allSizes={allSizesFor(null)}
            onSetRollSize={() => setDialog('roll')}
            onUpdate={update}
            onDocChange={(patch) => dispatch({ type: 'setDoc', patch: 'widthMm' in patch && 'heightMm' in patch ? asPatch(patch as LabelSize) : patch })}
            onDuplicate={duplicate}
            onRemove={(id) => dispatch({ type: 'remove', id })}
            onReorder={(id, direction) => dispatch({ type: 'reorder', id, direction })}
            onReplaceImage={(id) => void chooseImage(id)}
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
        rollSize={roll.size}
        onPick={createNew}
      />
      <SizeDialog
        key={dialog === 'roll' ? 'roll' : 'roll-closed'}
        open={dialog === 'roll'}
        onOpenChange={(o) => setDialog(o ? 'roll' : null)}
        title="What size is this roll?"
        description={`${status.profile?.name ?? 'This printer'} does not report it. niimai remembers it for this roll.`}
        actionLabel="Remember size"
        rollSize={null}
        initial={sizesForPrinter(status.profile)[0] ?? docSize}
        presets={sizesForPrinter(status.profile)}
        onPick={saveRollSize}
      />
      <IconPicker
        open={dialog === 'icon'}
        onOpenChange={(o) => setDialog(o ? 'icon' : null)}
        weight={(selected?.type === 'icon' && iconTarget ? selected.weight : null) ?? 'bold'}
        onPick={pickIcon}
      />
      <LibraryDialog
        open={dialog === 'library'}
        onOpenChange={(o) => setDialog(o ? 'library' : null)}
        currentId={doc.id}
        currentSize={roll.size ?? docSize}
        initialTab={libraryTab}
        onOpen={(d) => loadDoc(d)}
      />
      <PrintDialog
        open={dialog === 'print'}
        onOpenChange={(o) => setDialog(o ? 'print' : null)}
        doc={doc}
        status={status}
        preview={preview}
        density={density}
        onDensity={changeDensity}
        onPrint={printToPrinter}
        onBrowserPrint={printFromBrowser}
        onConnect={() => setDialog('printer')}
      />
      <PrinterDialog
        open={dialog === 'printer'}
        onOpenChange={(o) => setDialog(o ? 'printer' : null)}
        status={status}
        rollSize={roll.size}
        rollNeedsSize={roll.needsSize}
        rollName={roll.name}
        onSetRollSize={() => setDialog('roll')}
        manualProfileId={manualProfileId}
        onConnect={connect}
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
      try {
        const lastId = await getSetting('lastLabelId');
        if (lastId) doc = await getLabel(lastId);
        profileId = (await getSetting('manualProfileId')) ?? null;
        density = await getSetting('density');
        rollSizes = (await getSetting('rollSizes')) ?? {};
      } catch {
        // Private windows can block IndexedDB; the editor still works without it.
      }
      setBoot({ initialDoc: doc ?? starterDoc(), initialProfileId: profileId, initialDensity: density, initialRollSizes: rollSizes });
    })();
  }, []);
  if (!boot) return <div className="app-loading" aria-busy="true" />;
  return <Editor {...boot} initialView="start" />;
}
