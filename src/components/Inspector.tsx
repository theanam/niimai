import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Copy,
  Italic,
  Maximize2,
  RotateCw,
  ScanLine,
  SquareDashed,
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
import { PAPER_TYPES, paperName, type PaperType } from '../printer/paper';
import type { RollState } from '../printer/roll';
import { symbolError } from '../render/barcode';
import { IconButton } from '../ui/IconButton';
import { ELEMENT_META } from './elementMeta';
import { NumberField, Section, Segmented, Toggle } from './fields';
import { FontPicker } from './FontPicker';
import { FramePicker } from './FramePicker';
import { LabelSizePicker } from './LabelSizePicker';

interface Props {
  doc: LabelDoc;
  selected: LabelElement | null;
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
  onDocChange: (patch: Partial<Pick<LabelDoc, 'widthMm' | 'heightMm' | 'tailMm' | 'fold' | 'paper' | 'name'>>) => void;
  onDuplicate: (el: LabelElement) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onReplaceImage: (id: string) => void;
  onReplaceIcon: (id: string) => void;
  /** Opens in-place editing for a text element. */
  onEditText?: (id: string) => void;
  /** Why the selected element would print badly, if it would. */
  printIssue?: string | null;
}

const FORMATS: { value: BarcodeFormat; label: string }[] = [
  { value: 'code128', label: 'Code 128' },
  { value: 'code39', label: 'Code 39' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'upca', label: 'UPC-A' },
];

export function Inspector({ doc, selected, roll, rollPaper, fitting = [], allSizes = LABEL_PRESETS, onSetRollSize, onUpdate, onDocChange, onDuplicate, onRemove, onReorder, onReplaceImage, onReplaceIcon, onEditText, printIssue }: Props) {
  if (!selected) {
    const isPreset = [...(roll.size ? [roll.size] : []), ...allSizes].some((p) => sameSize(p, doc));
    return (
      <aside className="inspector" aria-label="Label settings">
        <Section title="Label">
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
          </details>
        </Section>
      </aside>
    );
  }

  const el = selected;
  const set = (patch: Partial<LabelElement>, key?: string) => onUpdate(el.id, patch, key);
  const Meta = ELEMENT_META[el.type];
  const error = el.type === 'qr' || el.type === 'barcode' ? symbolError(el) : null;

  return (
    <aside className="inspector" aria-label={`${Meta.label} settings`}>
      <Section
        title={Meta.label}
        actions={
          <>
            <IconButton label="Bring forward" onClick={() => onReorder(el.id, 'up')}>
              <ArrowUpToLine size={16} />
            </IconButton>
            <IconButton label="Send backward" onClick={() => onReorder(el.id, 'down')}>
              <ArrowDownToLine size={16} />
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
        {printIssue && (
          <p className="print-issue" role="status">
            <TriangleAlert size={15} aria-hidden="true" /> {printIssue}
          </p>
        )}
        <div className="grid-2">
          <NumberField label="X" value={el.x} suffix="mm" onChange={(x) => set({ x }, 'x')} />
          <NumberField label="Y" value={el.y} suffix="mm" onChange={(y) => set({ y }, 'y')} />
          <NumberField label="Width" icon="W" value={el.w} min={0.5} suffix="mm" onChange={(w) => set({ w }, 'w')} />
          <NumberField label="Height" icon="H" value={el.h} min={0.5} suffix="mm" onChange={(h) => set({ h }, 'h')} />
          <NumberField label="Rotation" icon={<RotateCw size={13} />} value={el.rotation} step={1} suffix="°" onChange={(rotation) => set({ rotation }, 'rotation')} />
        </div>
      </Section>

      {el.type === 'text' && (
        <Section title="Style">
          {onEditText && (
            <button className="btn btn-block" onClick={() => onEditText(el.id)}>
              <Pencil size={16} /> Edit text
            </button>
          )}
          <FontPicker value={el.fontFamily} onChange={(fontFamily) => set({ fontFamily })} />
          <div className="row">
            <Toggle label="Fit to box" icon={<Maximize2 size={15} />} checked={el.autoFit} onChange={(autoFit) => set({ autoFit })} />
            <NumberField label="Font size" icon="pt" value={el.fontSize} min={1} max={400} step={1} onChange={(fontSize) => set({ fontSize, autoFit: false }, 'fontSize')} />
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
        <Section title="Dithering">
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
        <Section title="Style">
          <button className="btn btn-block" onClick={() => onReplaceIcon(el.id)}>
            <Smile size={16} /> {el.body ? iconLabel(el.name) : 'Choose icon'}
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
        <Section title="Content">
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

      {el.type === 'frame' && (
        <Section title="Style">
          <FramePicker value={el.style} onPick={(style) => set({ style })} />
          <NumberField label="Stroke width" icon={<SquareDashed size={13} />} value={el.strokeWidth} min={0.1} max={5} suffix="mm" onChange={(strokeWidth) => set({ strokeWidth }, 'stroke')} />
        </Section>
      )}

      {(el.type === 'rect' || el.type === 'ellipse' || el.type === 'line') && (
        <Section title="Stroke">
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
