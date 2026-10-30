import { CalendarDays, Check, Clock, FileSpreadsheet, Hash, Minus, Plus, Table2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LabelDoc } from '../doc/model';
import {
  columnIndex,
  DATE_FORMATS,
  DEFAULT_SEQUENCE,
  fieldName,
  formatDate,
  formatTime,
  parseField,
  sequenceCount,
  sequenceValue,
  TIME_FORMATS,
  type NumberSequence,
} from '../doc/variables';

interface Props {
  field: string;
  doc: LabelDoc;
  onChange: (field: string) => void;
  onSequence: (sequence: NumberSequence) => void;
  onAddSheet: () => void;
}

/** Day counts offered as one-click choices for dates. */
const DAY_PRESETS = [0, 7, 30, 90, 365];

function Head({ icon, title, value }: { icon: ReactNode; title: string; value?: string }) {
  return (
    <header className="fo-head">
      <span className="fo-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
      {value !== undefined && <span className="fo-value">{value || 'empty'}</span>}
    </header>
  );
}

/** A short list to pick one from, each choice showing what it prints. */
function Choices<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: { value: T; main: string; note?: string }[]; onPick: (v: T) => void }) {
  return (
    <div className="fo-choices" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className="fo-choice" onClick={() => onPick(o.value)}>
          <span className="fo-choice-main">{o.main}</span>
          {o.note && <span className="fo-choice-note">{o.note}</span>}
          {o.value === value && <Check size={14} className="fo-check" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

/** A whole number with minus and plus buttons. Empty is allowed when `optional`, and reads as none. */
function Stepper({ label, value, onChange, min, max, optional = false }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; optional?: boolean }) {
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.round(v)));
  const step = (d: number) => onChange(clamp((value ?? 0) + d));
  return (
    <div className="fo-stepper">
      <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => step(-1)} disabled={value !== undefined && min !== undefined && value <= min}>
        <Minus size={13} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        placeholder={optional ? 'None' : undefined}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(optional ? undefined : (min ?? 0));
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
      />
      <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => step(1)} disabled={value !== undefined && max !== undefined && value >= max}>
        <Plus size={13} />
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fo-row">
      <span className="fo-label">{label}</span>
      {children}
    </div>
  );
}

const dayNote = (n: number) => (n === 0 ? 'Today' : `${n > 0 ? '+' : '−'}${Math.abs(n)}`);

/** The settings behind one field's tag: how a date reads, where numbers run, which column fills it. */
export function FieldOptions({ field, doc, onChange, onSequence, onAddSheet }: Props) {
  const spec = parseField(field, doc.sheet);
  const today = new Date();

  if (spec.kind === 'date') {
    const day = new Date(today);
    day.setDate(day.getDate() + spec.offset);
    return (
      <div className="fo">
        <Head icon={<CalendarDays size={14} />} title="Date" value={formatDate(day, spec.format)} />
        <section className="fo-section">
          <Row label="Days from today">
            <Stepper label="Days from today" value={spec.offset} onChange={(offset) => onChange(fieldName({ ...spec, offset: offset ?? 0 }))} />
          </Row>
          <div className="fo-presets" role="group" aria-label="Quick days">
            {DAY_PRESETS.map((n) => (
              <button key={n} type="button" className={`fo-preset${spec.offset === n ? ' active' : ''}`} onClick={() => onChange(fieldName({ ...spec, offset: n }))}>
                {dayNote(n)}
              </button>
            ))}
          </div>
        </section>
        <section className="fo-section">
          <span className="fo-label">Format</span>
          <Choices
            label="Date format"
            value={spec.format ?? 'medium'}
            options={DATE_FORMATS.map((f) => ({ value: f.value, main: formatDate(day, f.value), note: f.label }))}
            onPick={(format) => onChange(fieldName({ ...spec, format }))}
          />
        </section>
      </div>
    );
  }

  if (spec.kind === 'time') {
    return (
      <div className="fo">
        <Head icon={<Clock size={14} />} title="Time" value={formatTime(today, spec.format)} />
        <section className="fo-section">
          <span className="fo-label">Format</span>
          <Choices
            label="Time format"
            value={spec.format ?? 'local'}
            options={TIME_FORMATS.map((f) => ({ value: f.value, main: formatTime(today, f.value), note: f.label }))}
            onPick={(format) => onChange(fieldName({ ...spec, format }))}
          />
        </section>
      </div>
    );
  }

  if (spec.kind === 'number') {
    const seq = { ...DEFAULT_SEQUENCE, ...doc.sequence };
    const set = (patch: Partial<NumberSequence>) => onSequence({ ...seq, ...patch });
    const count = sequenceCount(seq);
    return (
      <div className="fo">
        <Head icon={<Hash size={14} />} title="Number" value={count ? `${sequenceValue(seq, 0)} – ${sequenceValue(seq, count - 1)}` : `${sequenceValue(seq, 0)}, ${sequenceValue(seq, 1)}, …`} />
        <section className="fo-section">
          <Row label="Start">
            <Stepper label="Start" value={seq.start} onChange={(start) => set({ start: start ?? 0 })} />
          </Row>
          <Row label="End">
            <Stepper label="End" value={seq.end} optional onChange={(end) => set({ end })} />
          </Row>
          <Row label="Step">
            <Stepper label="Step" value={seq.step} onChange={(step) => set({ step: step || 1 })} />
          </Row>
          <Row label="Digits">
            <Stepper label="Digits" value={seq.digits} min={1} max={12} onChange={(digits) => set({ digits: digits ?? 1 })} />
          </Row>
        </section>
        <p className="fo-foot">
          {count ? `${count} ${count === 1 ? 'label' : 'labels'}. ` : 'No end: choose how many when printing. '}
          Shared by every Number on this label.
        </p>
      </div>
    );
  }

  const columns = doc.sheet?.columns ?? [];
  const index = columnIndex(doc.sheet, spec.name);
  const sample = (i: number) => doc.sheet?.rows[0]?.[i] ?? '';
  return (
    <div className="fo">
      <Head icon={<Table2 size={14} />} title={spec.name} value={index >= 0 ? sample(index) : undefined} />
      {columns.length > 0 ? (
        <section className="fo-section">
          <span className="fo-label">Column</span>
          {index < 0 && <p className="fo-warn">{spec.name} is not a column in {doc.sheet!.name}.</p>}
          <Choices
            label="Column"
            value={index >= 0 ? columns[index] : ''}
            options={columns.map((c, i) => ({ value: c, main: c, note: sample(i) || undefined }))}
            onPick={(c) => onChange(c)}
          />
        </section>
      ) : (
        <section className="fo-section">
          <p className="fo-foot">Filled from a sheet column named {spec.name}.</p>
          <button type="button" className="btn btn-sm btn-block" onClick={onAddSheet}>
            <FileSpreadsheet size={15} /> Add sheet
          </button>
        </section>
      )}
    </div>
  );
}
