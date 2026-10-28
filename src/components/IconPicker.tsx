import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { filterIcons, ICON_WEIGHTS, iconLabel, loadIconCatalog, loadIconShapes, sanitizeIconBody, type IconCatalog, type IconEntry, type IconWeight } from '../icons/catalog';
import { Dialog } from '../ui/Dialog';
import { useIncremental } from '../ui/useIncremental';
import { Segmented } from './fields';

export interface PickedIcon {
  name: string;
  weight: IconWeight;
  body: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  weight: IconWeight;
  onPick: (icon: PickedIcon) => void;
}

const PAGE = 160;
const NONE: IconEntry[] = [];
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Browses Phosphor Icons by category and search, in the weight that will print. */
export function IconPicker({ open, onOpenChange, weight: initialWeight, onPick }: Props) {
  const [catalog, setCatalog] = useState<IconCatalog | null>(null);
  const [shapes, setShapes] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weight, setWeight] = useState<IconWeight>(initialWeight);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (open) setWeight(initialWeight);
  }, [open, initialWeight]);

  useEffect(() => {
    if (!open || catalog) return;
    loadIconCatalog().then(setCatalog, (e: Error) => setError(e.message));
  }, [open, catalog]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setShapes(null);
    loadIconShapes(weight).then(
      (s) => live && setShapes(s),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [open, weight]);

  const matching = useMemo(() => (catalog ? filterIcons(catalog.icons, query) : NONE), [catalog, query]);
  const shown = useMemo(() => (category ? matching.filter((i) => i.categories.includes(category)) : matching), [matching, category]);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of matching) for (const cat of i.categories) c.set(cat, (c.get(cat) ?? 0) + 1);
    return c;
  }, [matching]);
  const { visible, more, sentinel, showMore } = useIncremental(shapes ? shown : NONE, PAGE);

  const pick = (name: string) => {
    if (!shapes?.[name]) return;
    onPick({ name, weight, body: sanitizeIconBody(shapes[name]) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Icons" className="dialog-library" focusContent>
      <div className="templates">
        <div className="templates-bar">
          <label className="search">
            <Search size={15} />
            <input type="search" placeholder="Search icons" aria-label="Search icons" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <Segmented<IconWeight> label="Weight" value={weight} onChange={setWeight} options={ICON_WEIGHTS} />
        </div>
        <div className="templates-body">
          <nav className="categories" aria-label="Icon categories">
            <button className={!category ? 'active' : ''} onClick={() => setCategory(null)}>
              <span>All</span>
              <small>{matching.length}</small>
            </button>
            {catalog?.categories.map((c) => (
              <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)} disabled={!counts.get(c)}>
                <span>{titleCase(c)}</span>
                <small>{counts.get(c) ?? 0}</small>
              </button>
            ))}
          </nav>
          <div className="templates-scroll">
            {error && <p className="library-empty muted">{error}</p>}
            {!error && (!catalog || !shapes) && <p className="library-empty muted">Loading icons…</p>}
            {catalog && shapes && !shown.length && <p className="library-empty muted">No icons match.</p>}
            <ul className="icon-grid" aria-label="Icons">
              {visible.map((i) => (
                <li key={i.name}>
                  <button className="icon-cell" onClick={() => pick(i.name)} aria-label={iconLabel(i.name)} title={iconLabel(i.name)}>
                    <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: shapes?.[i.name] ?? '' }} />
                  </button>
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
        <p className="icon-credit muted small">
          Icons by{' '}
          <a href="https://phosphoricons.com" target="_blank" rel="noreferrer">
            Phosphor
          </a>
          , MIT licence.
        </p>
      </div>
    </Dialog>
  );
}
