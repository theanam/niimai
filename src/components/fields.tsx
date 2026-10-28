import { useEffect, useId, useState, type ReactNode } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  icon?: ReactNode;
}

/** Numeric input that keeps the user's partial text while typing. */
export function NumberField({ label, value, onChange, step = 0.1, min, max, suffix, icon }: NumberFieldProps) {
  const id = useId();
  const shown = String(Math.round(value * 100) / 100);
  const [text, setText] = useState(shown);
  useEffect(() => {
    if (Number(text) !== value) setText(shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <label className="field field-number" htmlFor={id} title={label}>
      <span className="field-label">{icon ?? label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={text}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(v)) {
            onChange(min !== undefined || max !== undefined ? Math.min(max ?? v, Math.max(min ?? v, v)) : v);
          }
        }}
        onBlur={() => setText(shown)}
      />
      {suffix && <span className="field-suffix">{suffix}</span>}
    </label>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.label}
          title={o.label}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={`toggle${checked ? ' active' : ''}`}
      aria-pressed={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
    >
      {icon ?? label}
    </button>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panel-section">
      <header>
        <h3>{title}</h3>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
