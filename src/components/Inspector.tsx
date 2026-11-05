import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  BoxSelect,
  Copy,
  Group,
  Italic,
  Lock,
  LockOpen,
  RotateCw,
  ScanLine,
  SquareDashed,
  Ungroup,
  Trash2,
  Contrast,
  ImageUp,
  PaintBucket,
  Smile,
  Cable,
  Pencil,
  FoldHorizontal,
  TriangleAlert,
  Minus,
  Slash,
} from 'lucide-react';
import { ICON_WEIGHTS, iconBody, iconLabel, type IconWeight } from '../icons/catalog';
import { sameSize } from '../printer/roll';
import type { BarcodeFormat, DitherMode, FoldMode, LabelDoc, LabelElement, LineDirection } from '../doc/model';
import { LABEL_PRESETS, placementArea, reshapeLine, type LabelSize } from '../doc/model';
import { PAPER_TYPES, paperName, type PaperType, THERMAL_HEAD_MM } from 'libniimai';
import type { RollState } from '../printer/roll';
import { symbolError } from '../render/barcode';
import { IconButton } from '../ui/IconButton';
import { ELEMENT_META } from './elementMeta';
import { NumberField, Section, Segmented, Toggle } from './fields';
import { alignPatches, distributePatches, type AlignTo, type Axis } from '../doc/align';
import { HUGS, placePatch, shownFontSize, tighten } from '../doc/bounds';
import { FontPicker } from './FontPicker';
import { FramePicker } from './FramePicker';
import { DataSection, DynamicSection } from './DataPanel';
import { canBeDynamic } from '../doc/variables';
import { LabelSizePicker } from './LabelSizePicker';

interface Props {
  doc: LabelDoc;
  selected: LabelElement | null;
  /** Every selected element; with more than one, the panel aligns and spaces them. */
  selection?: LabelElement[];
  /** Moves several elements as one step. */
  onUpdateMany?: (patches: Record<string, Partial<LabelElement>>) => void;
  onRemoveMany?: (ids: string[]) => void;
  onDuplicateMany?: (els: LabelElement[]) => void;
  roll: RollState;
  /** Paper type the loaded roll reports, if any. */
  rollPaper?: PaperType;
  /** Sizes that suit the connected printer, listed first. */
  fitting?: LabelSize[];
  /** Every preset size. */
  allSizes?: LabelSize[];
  /** Opens the dialog for naming the loaded roll's size. */
  onSetRollSize: () => void;
  onUpdate: (id: string, patch: Partial<LabelElement>, key?: string) => void;
  /** Switches the artboard between portrait and landscape. */
  onTurn?: () => void;
  onDocChange: (patch: Partial<Pick<LabelDoc, 'widthMm' | 'heightMm' | 'tailMm' | 'fold' | 'paper' | 'name' | 'sheet' | 'sequence'>>) => void;
  /** Opens a spreadsheet for the label's dynamic fields. */
  onAddSheet?: () => void;
  /** The element as the shown record prints it, for checking a dynamic code's value. */
  resolve?: (el: LabelElement) => LabelElement;
  onDuplicate: (el: LabelElement) => void;
  /** Joins elements into a group, or takes the groups they are in apart. */
  onGroup?: (ids: string[]) => void;
  onUngroup?: (ids: string[]) => void;
  onLock?: (ids: string[], locked: boolean) => void;
  /** Picks every element that is not locked. */
  onSelectAll?: () => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onReplaceImage: (id: string) => void;
  onReplaceIcon: (id: string) => void;
  /** Opens in-place editing for a text element. */
  onEditText?: (id: string) => void;
  /** Why the selected element would print badly, if it would. */
  printIssue?: string | null;
  /** Continuous paper (ESC/POS and cat printers): the label is set by width and length, with no presets. */
  continuous?: boolean;
  /** Sticker rolls on those printers: the gap between stickers, set in the printer window. */
  stickerGap?: number;
  /** The paper's width on those printers. */
  paperWidth?: number;
}

const FORMATS: { value: BarcodeFormat; label: string }[] = [
  { value: 'code128', label: 'Code 128' },
  { value: 'code39', label: 'Code 39' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'upca', label: 'UPC-A' },
];

const ALIGNS: { to: AlignTo; label: string; Icon: typeof AlignLeft }[] = [
  { to: 'left', label: 'Align left', Icon: AlignStartVertical },
  { to: 'centerX', label: 'Align centres across', Icon: AlignCenterVertical },
  { to: 'right', label: 'Align right', Icon: AlignEndVertical },
  { to: 'top', label: 'Align top', Icon: AlignStartHorizontal },
  { to: 'centerY', label: 'Align middles', Icon: AlignCenterHorizontal },
  { to: 'bottom', label: 'Align bottom', Icon: AlignEndHorizontal },
];

/** Align buttons, and spacing for three or more: to each other with several elements, to the label with one. */
function AlignTools({ doc, els, onUpdateMany }: { doc: LabelDoc; els: LabelElement[]; onUpdateMany: (patches: Record<string, Partial<LabelElement>>) => void }) {
  const area = placementArea(doc);
  const box = { x: 0, y: 0, w: area.widthMm, h: area.heightMm };
  const align = (to: AlignTo) => onUpdateMany(alignPatches(els, to, box));
  const spread = (axis: Axis) => onUpdateMany(distributePatches(els, axis));
  return (
    <div className="align-tools" role="group" aria-label={els.length > 1 ? 'Align' : 'Align to label'}>
      {ALIGNS.map(({ to, label, Icon }) => (
        <IconButton key={to} label={els.length > 1 ? label : `${label} on the label`} onClick={() => align(to)}>
          <Icon size={16} />
        </IconButton>
      ))}
      {els.length > 2 && (
        <>
          <IconButton label="Space evenly across" onClick={() => spread('x')}>
            <AlignHorizontalSpaceBetween size={16} />
          </IconButton>
          <IconButton label="Space evenly down" onClick={() => spread('y')}>
            <AlignVerticalSpaceBetween size={16} />
          </IconButton>
        </>
      )}
    </div>
  );
}

/** Locked elements cannot be picked on the canvas, so they are listed here to unlock. */
function LockedSection({ doc, onLock }: { doc: LabelDoc; onLock: (ids: string[], locked: boolean) => void }) {
  const locked = doc.elements.filter((e) => e.locked);
  if (!locked.length) return null;
  return (
    <Section
      title="Locked"
      id="locked"
      defaultOpen
      actions={
        locked.length > 1 && (
          <IconButton label="Unlock all" onClick={() => onLock(locked.map((e) => e.id), false)}>
            <LockOpen size={16} />
          </IconButton>
        )
      }
    >
      <ul className="locked-list">
        {locked.map((e) => {
          const { label, icon: Icon } = ELEMENT_META[e.type];
          const name = e.type === 'text' && e.text.trim() ? e.text.trim().split('\n')[0] : e.type === 'icon' && e.name ? iconLabel(e.name) : label;
          return (
            <li key={e.id}>
              <Icon size={15} aria-hidden="true" />
              <span className="locked-name">{name}</span>
              <IconButton label={`Unlock ${name}`} onClick={() => onLock([e.id], false)}>
                <LockOpen size={15} />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function Inspector({ doc, selected, selection = [], onUpdateMany = () => {}, onRemoveMany = () => {}, onDuplicateMany = () => {}, roll, rollPaper, fitting = [], allSizes = LABEL_PRESETS, onSetRollSize, onUpdate, onTurn = () => {}, onDocChange, onDuplicate, onGroup = () => {}, onUngroup = () => {}, onLock = () => {}, onSelectAll = () => {}, onRemove, onReorder, onReplaceImage, onReplaceIcon, onEditText, printIssue, continuous = false, stickerGap, paperWidth = THERMAL_HEAD_MM, onAddSheet = () => {}, resolve = (el) => el }: Props) {
  const data = <DataSection doc={doc} onAddSheet={onAddSheet} onDocChange={onDocChange} />;
  // Cable and flag labels wrap or fold along their length, so they stay portrait.
  const orientation = !doc.tailMm && !doc.fold && <Orientation landscape={!!doc.landscape} onTurn={onTurn} />;
  const selectAll = doc.elements.some((e) => !e.locked) && (
    <IconButton label="Select all" shortcut="⌘A" onClick={onSelectAll}>
      <BoxSelect size={16} />
    </IconButton>
  );
  if (selection.length > 1) {
    return (
      <aside className="inspector" aria-label="Selection settings">
        <Section
          title={`${selection.length} selected`}
          id="selection"
          actions={
            <>
              <IconButton label="Group" shortcut="⌘G" onClick={() => onGroup(selection.map((e) => e.id))}>
                <Group size={16} />
              </IconButton>
              {selection.some((e) => e.group) && (
                <IconButton label="Ungroup" shortcut="⇧⌘G" onClick={() => onUngroup(selection.map((e) => e.id))}>
                  <Ungroup size={16} />
                </IconButton>
              )}
              <IconButton label="Lock" shortcut="⇧⌘L" onClick={() => onLock(selection.map((e) => e.id), true)}>
                <Lock size={16} />
              </IconButton>
              <IconButton label="Duplicate" shortcut="⌘D" onClick={() => onDuplicateMany(selection)}>
                <Copy size={16} />
              </IconButton>
              <IconButton label="Delete" shortcut="⌫" onClick={() => onRemoveMany(selection.map((e) => e.id))}>
                <Trash2 size={16} />
              </IconButton>
            </>
          }
        >
          <AlignTools doc={doc} els={selection} onUpdateMany={onUpdateMany} />
          <p className="muted small selection-hint">
            <span className="hint-fine">Shift-click or drag across elements to change the selection.</span>
            <span className="hint-coarse">Long-press an element to add it or take it out.</span>
          </p>
        </Section>
      </aside>
    );
  }
  if (!selected && continuous) {
    return (
      <aside className="inspector" aria-label="Label settings">
        <Section title="Label" defaultOpen actions={selectAll}>
          <p className="muted small">
            {stickerGap !== undefined ? `Stickers with a ${stickerGap} mm gap; set the length to the sticker height.` : `Continuous paper, up to ${paperWidth} mm wide.`}
          </p>
          <div className="grid-2">
            <NumberField label="Width" icon="W" value={doc.widthMm} min={5} max={paperWidth} step={1} suffix="mm" onChange={(widthMm) => onDocChange({ widthMm })} />
            <NumberField label="Length" icon="L" value={doc.heightMm} min={5} max={500} step={1} suffix="mm" onChange={(heightMm) => onDocChange({ heightMm })} />
          </div>
          {orientation}
        </Section>
        <LockedSection doc={doc} onLock={onLock} />
        {data}
      </aside>
    );
  }

  if (!selected) {
    const isPreset = [...(roll.size ? [roll.size] : []), ...allSizes].some((p) => sameSize(p, doc));
    return (
      <aside className="inspector" aria-label="Label settings">
        <Section title="Label" defaultOpen actions={selectAll}>
          <LabelSizePicker
            value={doc}
            rollSize={roll.size}
            fitting={fitting}
            all={allSizes}
            onChange={(size) => onDocChange({ widthMm: size.widthMm, heightMm: size.heightMm, tailMm: size.tailMm, fold: size.fold })}
          />
          {roll.needsSize && (
            <button className="chip chip-primary" onClick={onSetRollSize} title="Set the loaded roll's size">
              <ScanLine size={14} /> Set the loaded roll's size
            </button>
          )}
          <label className="field field-select-inline">
            <span className="field-label-text">Paper</span>
            <select
              className="select"
              aria-label="Paper type"
              value={doc.paper ?? ''}
              onChange={(e) => onDocChange({ paper: (e.target.value || undefined) as PaperType | undefined })}
            >
              <option value="">{rollPaper ? `From roll · ${paperName(rollPaper)}` : 'Labels with gaps'}</option>
              {PAPER_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {orientation}
          {!!doc.fold && (
            <div className="field-select-inline">
              <span className="field-label-text">Sides</span>
              <Segmented<FoldMode>
                label="Second half"
                value={doc.fold}
                onChange={(fold) => onDocChange({ fold })}
                options={[
                  { value: 'copy', label: 'Same' },
                  { value: 'flip', label: 'Flipped' },
                  { value: 'none', label: 'Separate' },
                ]}
              />
            </div>
          )}
          <details className="custom-size" open={!isPreset || undefined}>
            <summary>Custom size</summary>
            <div className="grid-2">
              <NumberField label="Width" value={doc.widthMm} min={5} max={200} step={1} suffix="mm" icon="W" onChange={(v) => onDocChange({ widthMm: v })} />
              <NumberField label="Height" value={doc.heightMm} min={5} max={200} step={1} suffix="mm" icon="H" onChange={(v) => onDocChange({ heightMm: v })} />
            </div>
            {!doc.landscape && (
              <>
                <div className="row">
                  <Toggle
                    label="Cable label"
                    icon={
                      <>
                        <Cable size={15} /> Cable
                      </>
                    }
                    checked={!!doc.tailMm}
                    onChange={(on) => onDocChange({ tailMm: on ? Math.min(35, Math.round(doc.widthMm / 3)) : undefined })}
                  />
                  {!!doc.tailMm && (
                    <NumberField label="Tail length" icon="Tail" value={doc.tailMm} min={1} max={doc.widthMm - 5} step={1} suffix="mm" onChange={(tailMm) => onDocChange({ tailMm })} />
                  )}
                </div>
                <Toggle
                  label="Fold in the middle"
                  icon={
                    <>
                      <FoldHorizontal size={15} /> Fold
                    </>
                  }
                  checked={!!doc.fold}
                  onChange={(on) => onDocChange({ fold: on ? 'copy' : undefined })}
                />
              </>
            )}
          </details>
        </Section>
        <LockedSection doc={doc} onLock={onLock} />
        {data}
      </aside>
    );
  }

  const el = selected;
  const set = (patch: Partial<LabelElement>, key?: string) => onUpdate(el.id, patch, key);
  // Text and pictures show the box that hugs them, and keep their proportions when resized.
  const hugs = HUGS.has(el.type);
  const box = tighten(el);
  const frame = { x: box.x, y: box.y, w: box.w, h: box.h };
  const resize = (w: number, h: number): Partial<LabelElement> =>
    hugs ? placePatch(el, { x: box.x, y: box.y, w, h }) : { w, h };
  const Meta = ELEMENT_META[el.type];
  const shown = resolve(el);
  const error = shown.type === 'qr' || shown.type === 'barcode' ? symbolError(shown) : null;

  return (
    <aside className="inspector" aria-label={`${Meta.label} settings`}>
      {printIssue && (
        <p className="print-issue inspector-issue" role="status">
          <TriangleAlert size={15} aria-hidden="true" /> {printIssue}
        </p>
      )}
      <Section
        title={Meta.label}
        id="position"
        actions={
          <>
            <IconButton label="Bring forward" onClick={() => onReorder(el.id, 'up')}>
              <ArrowUpToLine size={16} />
            </IconButton>
            <IconButton label="Send backward" onClick={() => onReorder(el.id, 'down')}>
              <ArrowDownToLine size={16} />
            </IconButton>
            {el.group && (
              <IconButton label="Ungroup" shortcut="⇧⌘G" onClick={() => onUngroup([el.id])}>
                <Ungroup size={16} />
              </IconButton>
            )}
            <IconButton label="Lock" shortcut="⇧⌘L" onClick={() => onLock([el.id], true)}>
              <Lock size={16} />
            </IconButton>
            <IconButton label="Duplicate" shortcut="⌘D" onClick={() => onDuplicate(el)}>
              <Copy size={16} />
            </IconButton>
            <IconButton label="Delete" shortcut="⌫" onClick={() => onRemove(el.id)}>
              <Trash2 size={16} />
            </IconButton>
          </>
        }
      >
        <div className="grid-2">
          <NumberField label="X" value={box.x} suffix="mm" onChange={(x) => set({ ...frame, x }, 'x')} />
          <NumberField label="Y" value={box.y} suffix="mm" onChange={(y) => set({ ...frame, y }, 'y')} />
          <NumberField label="Width" icon="W" value={box.w} min={0.5} suffix="mm" onChange={(w) => set(resize(w, hugs ? box.h * (w / box.w) : box.h), 'w')} />
          <NumberField label="Height" icon="H" value={box.h} min={0.5} suffix="mm" onChange={(h) => set(resize(hugs ? box.w * (h / box.h) : box.w, h), 'h')} />
          <NumberField label="Rotation" icon={<RotateCw size={13} />} value={el.rotation} step={1} suffix="°" onChange={(rotation) => set({ rotation }, 'rotation')} />
        </div>
        <AlignTools doc={doc} els={[el]} onUpdateMany={onUpdateMany} />
      </Section>

      {el.type === 'text' && (
        <Section title="Style" id="text-style" defaultOpen>
          {onEditText && (
            <button className="btn btn-block" onClick={() => onEditText(el.id)}>
              <Pencil size={16} /> Edit text
            </button>
          )}
          <div className="font-size-row">
            <FontPicker value={el.fontFamily} onChange={(fontFamily) => set({ fontFamily })} />
            <NumberField label="Font size" icon="pt" value={shownFontSize(el)} min={1} max={400} step={1} onChange={(fontSize) => set({ fontSize, autoFit: false }, 'fontSize')} />
          </div>
          <div className="row">
            <Toggle label="Bold" icon={<Bold size={15} />} checked={el.bold} onChange={(bold) => set({ bold })} />
            <Toggle label="Italic" icon={<Italic size={15} />} checked={el.italic} onChange={(italic) => set({ italic })} />
            <Segmented
              label="Alignment"
              value={el.align}
              onChange={(align) => set({ align })}
              options={[
                { value: 'left', label: 'Align left', icon: <AlignLeft size={15} /> },
                { value: 'center', label: 'Align centre', icon: <AlignCenter size={15} /> },
                { value: 'right', label: 'Align right', icon: <AlignRight size={15} /> },
              ]}
            />
          </div>
        </Section>
      )}

      {el.type === 'image' && (
        <Section title="Dithering" id="image" defaultOpen>
          <button className="btn btn-block" onClick={() => onReplaceImage(el.id)}>
            <ImageUp size={16} /> {el.src ? 'Replace' : 'Choose image'}
          </button>
          <Segmented<DitherMode>
            label="Dithering"
            value={el.dither}
            onChange={(dither) => set({ dither })}
            options={[
              { value: 'threshold', label: 'Threshold' },
              { value: 'floyd', label: 'Floyd' },
              { value: 'atkinson', label: 'Atkinson' },
            ]}
          />
          <label className="field field-range" title="Darkness">
            <Contrast size={15} aria-hidden="true" />
            <input
              type="range"
              aria-label="Darkness"
              min={20}
              max={235}
              value={el.threshold}
              onChange={(e) => set({ threshold: Number(e.target.value) }, 'threshold')}
            />
          </label>
          <Toggle label="Invert" checked={el.invert} onChange={(invert) => set({ invert })} />
        </Section>
      )}

      {el.type === 'icon' && (
        <Section title="Style" id="icon-style" defaultOpen>
          <button className="btn btn-block" onClick={() => onReplaceIcon(el.id)}>
            {el.body ? (
              // The body is sanitised path data (see sanitizeIconBody), never raw file contents.
              <svg className="icon-preview" width={16} height={16} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: el.body }} />
            ) : (
              <Smile size={16} />
            )}{' '}
            {el.body ? iconLabel(el.name) : 'Choose icon'}
          </button>
          <Segmented<IconWeight>
            label="Weight"
            value={el.weight}
            options={ICON_WEIGHTS}
            onChange={(weight) => {
              if (!el.name) return set({ weight });
              iconBody(el.name, weight).then(
                (body) => set({ weight, body }),
                () => {},
              );
            }}
          />
        </Section>
      )}

      {(el.type === 'qr' || el.type === 'barcode') && (
        <Section title="Content" id="code" defaultOpen>
          {el.type === 'barcode' && (
            <select className="select" aria-label="Format" value={el.format} onChange={(e) => set({ format: e.target.value as BarcodeFormat })}>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
          <textarea
            className="text-input"
            aria-label="Value"
            aria-invalid={!!error}
            rows={el.type === 'qr' ? 3 : 1}
            value={el.value}
            onChange={(e) => set({ value: e.target.value }, 'value')}
          />
          {error && <p className="field-error">{error}</p>}
          {el.type === 'barcode' && <Toggle label="Show digits" checked={el.showText} onChange={(showText) => set({ showText })} />}
        </Section>
      )}

      {canBeDynamic(el) && (
        <DynamicSection el={el} shown={shown as typeof el} doc={doc} onChange={set} onAddSheet={onAddSheet} onSequence={(sequence) => onDocChange({ sequence })} />
      )}

      {el.type === 'frame' && (
        <Section title="Style" id="frame-style" defaultOpen>
          <FramePicker value={el.style} onPick={(style) => set({ style })} />
          <NumberField label="Stroke width" icon={<SquareDashed size={13} />} value={el.strokeWidth} min={0.1} max={5} suffix="mm" onChange={(strokeWidth) => set({ strokeWidth }, 'stroke')} />
        </Section>
      )}

      {(el.type === 'rect' || el.type === 'ellipse' || el.type === 'line') && (
        <Section title="Stroke" id="stroke" defaultOpen>
          {el.type === 'line' && (
            <Segmented<LineDirection>
              label="Direction"
              value={el.direction}
              onChange={(direction) => set(reshapeLine(el, direction, placementArea(doc)))}
              options={[
                { value: 'horizontal', label: 'Horizontal', icon: <Minus size={15} /> },
                { value: 'vertical', label: 'Vertical', icon: <Minus size={15} style={{ transform: 'rotate(90deg)' }} /> },
                { value: 'down', label: 'Diagonal down', icon: <Slash size={15} style={{ transform: 'scaleX(-1)' }} /> },
                { value: 'up', label: 'Diagonal up', icon: <Slash size={15} /> },
              ]}
            />
          )}
          <div className="row">
            <NumberField label="Stroke width" icon={<SquareDashed size={13} />} value={el.strokeWidth} min={0.1} max={20} suffix="mm" onChange={(strokeWidth) => set({ strokeWidth }, 'stroke')} />
            {el.type !== 'line' && <Toggle label="Fill" icon={<PaintBucket size={15} />} checked={el.fill} onChange={(fill) => set({ fill })} />}
          </div>
          {el.type === 'rect' && (
            <NumberField label="Corner radius" icon="R" value={el.radius} min={0} max={50} suffix="mm" onChange={(radius) => set({ radius }, 'radius')} />
          )}
        </Section>
      )}
    </aside>
  );
}

/** Portrait draws on the paper as it lies; landscape turns the artboard a quarter, and the print turns back onto the paper. */
function Orientation({ landscape, onTurn }: { landscape: boolean; onTurn: () => void }) {
  return (
    <div className="orientation">
      <Segmented<'portrait' | 'landscape'>
        label="Orientation"
        value={landscape ? 'landscape' : 'portrait'}
        onChange={(v) => v !== (landscape ? 'landscape' : 'portrait') && onTurn()}
        options={[
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ]}
      />
    </div>
  );
}
