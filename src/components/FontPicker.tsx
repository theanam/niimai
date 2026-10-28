import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, filterFonts, loadCatalog, previewUrl, type FontCategory, type FontEntry } from '../fonts/catalog';

const ROW = 36;
const VISIBLE = 9;
const previewed = new Set<string>();

function loadPreview(f: FontEntry): void {
  if (previewed.has(f.name)) return;
  previewed.add(f.name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = previewUrl(f);
  document.head.appendChild(link);
}

interface Props {
  value: string;
  onChange: (family: string) => void;
}

/** Every Google Font, grouped by category, each row drawn in its own face. */
export function FontPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState<FontEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<FontCategory | 'all'>('all');
  const [scroll, setScroll] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || fonts.length) return;
    loadCatalog().then(setFonts, (e: Error) => setError(e.message));
  }, [open, fonts.length]);

  const list = useMemo(() => filterFonts(fonts, query, cat), [fonts, query, cat]);
  const first = Math.max(0, Math.floor(scroll / ROW) - 2);
  const slice = list.slice(first, first + VISIBLE + 4);

  useEffect(() => slice.forEach(loadPreview), [slice]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    setScroll(0);
  }, [query, cat]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="font-trigger" aria-label="Font">
          <span style={{ fontFamily: `'${value}', sans-serif` }}>{value}</span>
          <ChevronDown size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover font-picker" sideOffset={6} align="start">
          <div className="font-search">
            <Search size={14} />
            <input autoFocus placeholder="Search fonts" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search fonts" />
          </div>
          <div className="font-cats" role="tablist">
            {CATEGORIES.map((c) => (
              <button key={c.id} role="tab" aria-selected={cat === c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <div
            className="font-list"
            ref={listRef}
            role="listbox"
            aria-label="Fonts"
            style={{ height: ROW * VISIBLE }}
            onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
          >
            {error && <p className="muted pad">{error}</p>}
            {!error && !fonts.length && <p className="muted pad">Loading…</p>}
            {fonts.length > 0 && !list.length && <p className="muted pad">No matches</p>}
            <div style={{ height: list.length * ROW, position: 'relative' }}>
              {slice.map((f, i) => (
                <button
                  key={f.id}
                  role="option"
                  aria-selected={f.name === value}
                  className={`font-row${f.name === value ? ' active' : ''}`}
                  style={{ top: (first + i) * ROW, height: ROW, fontFamily: `'${f.name}', sans-serif` }}
                  onClick={() => {
                    onChange(f.name);
                    setOpen(false);
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
