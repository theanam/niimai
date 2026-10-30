import * as Popover from '@radix-ui/react-popover';
import { Braces, ChevronDown, X } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { fromParts, toParts, type Part } from '../doc/variables';

/** Line breaks shown as a glyph, so a part stays on one line. */
const shown = (v: string) => v.replace(/\n/g, '↵');
const stored = (v: string) => v.replace(/↵/g, '\n');

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** A field's name on its tag; the name as written by default. */
  label?: (field: string) => string;
  /** Settings for a field, shown from its tag. `change` rewrites that field. */
  options?: (field: string, change: (field: string) => void) => ReactNode;
}

/**
 * Dynamic content as tags, the way blog editors show tags: each field and
 * each run of words is a pill with its own remove button. Words are edited
 * in place; typing at the end adds more, and fields typed as {{Name}} become
 * tags.
 */
export function PartsEditor({ value, onChange, label = (f) => f, options }: Props) {
  const parts = toParts(value);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLInputElement>(null);
  const commit = (next: Part[]) => onChange(fromParts(next));
  const remove = (i: number) => commit(parts.filter((_, j) => j !== i));
  const replace = (i: number, text: string) => commit([...parts.slice(0, i), ...toParts(stored(text)), ...parts.slice(i + 1)]);

  const add = () => {
    if (!draft) return;
    onChange(value + stored(draft));
    setDraft('');
  };
  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !draft && parts.length) {
      e.preventDefault();
      remove(parts.length - 1);
    }
  };

  return (
    <div className="parts" role="list" aria-label="Dynamic content" onClick={(e) => e.target === e.currentTarget && draftRef.current?.focus()}>
      {parts.map((p, i) =>
        p.kind === 'text' && editing === i ? (
          <input
            key={i}
            className="part-input"
            aria-label="Edit text part"
            autoFocus
            defaultValue={shown(p.value)}
            size={Math.max(2, shown(p.value).length)}
            onBlur={(e) => {
              setEditing(null);
              replace(i, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(null);
            }}
          />
        ) : (
          <span key={i} role="listitem" className={`part part-${p.kind}`}>
            {p.kind === 'field' ? (
              options ? (
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button type="button" className="part-label" aria-label={`${label(p.name)} options`}>
                      <Braces size={11} aria-hidden="true" />
                      {label(p.name)}
                      <ChevronDown size={11} aria-hidden="true" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="popover field-options"
                      side="bottom"
                      align="start"
                      sideOffset={6}
                      aria-label={`${label(p.name)} options`}
                      // Escape closes the options only; the element stays selected.
                      onEscapeKeyDown={(e) => e.stopPropagation()}
                    >
                      {options(p.name, (name) => commit(parts.map((q, j) => (j === i ? { kind: 'field', name } : q))))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              ) : (
                <span className="part-label">
                  <Braces size={11} aria-hidden="true" />
                  {label(p.name)}
                </span>
              )
            ) : (
              <button type="button" className="part-label" onClick={() => setEditing(i)} title="Edit">
                {/* Spaces alone would make an empty tag; show them as a mark. */}
                {p.value.trim() ? shown(p.value) : <span className="part-space">{'␣'.repeat(Math.min(3, p.value.length))}</span>}
              </button>
            )}
            <button type="button" className="part-remove" aria-label={`Remove ${p.kind === 'field' ? label(p.name) : `“${p.value.trim() || 'space'}”`}`} onClick={() => remove(i)}>
              <X size={11} />
            </button>
          </span>
        ),
      )}
      <input
        ref={draftRef}
        className="part-draft"
        aria-label="Add text"
        placeholder={parts.length ? '' : 'Type text, or pick a field'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onDraftKey}
        onBlur={add}
      />
    </div>
  );
}
