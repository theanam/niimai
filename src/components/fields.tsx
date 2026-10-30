import { ChevronRight } from 'lucide-react';
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

/** An on/off switch, for settings that turn a whole section on. */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} title={label} onClick={() => onChange(!checked)}>
      <span className="switch-thumb" />
    </button>
  );
}

const SECTIONS_KEY = 'niimai:sections';

/** Which panel sections the user opened or closed, remembered on this device. */
function storedOpen(id: string): boolean | undefined {
  try {
    return (JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, boolean>)[id];
  } catch {
    return undefined;
  }
}

function storeOpen(id: string, open: boolean): void {
  try {
    const all = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, boolean>;
    localStorage.setItem(SECTIONS_KEY, JSON.stringify({ ...all, [id]: open }));
  } catch {
    // Private windows can refuse storage; sections still open and close.
  }
}

interface SectionProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Names the section for remembering whether it is open; the title by default. */
  id?: string;
  defaultOpen?: boolean;
  /** Off for sections that open and close with what they hold, such as Dynamic with its switch. */
  remember?: boolean;
}

/** A panel section that folds away. Actions stay in the header either way. */
export function Section({ title, children, actions, id, defaultOpen = false, remember = true }: SectionProps) {
  const key = id ?? title.toLowerCase();
  const [open, setOpen] = useState(() => (remember ? storedOpen(key) : undefined) ?? defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (remember) storeOpen(key, next);
  };
  return (
    <section className={`panel-section${open ? '' : ' collapsed'}`}>
      <header>
        <h3>
          <button type="button" className="section-toggle" aria-expanded={open} onClick={toggle}>
            <ChevronRight size={14} className="section-chevron" aria-hidden="true" />
            {title}
          </button>
        </h3>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {open && children}
    </section>
  );
}
