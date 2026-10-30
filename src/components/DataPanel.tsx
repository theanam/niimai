import type { ReactNode } from 'react';
import { CalendarDays, Clock, FileSpreadsheet, Hash, RefreshCw, Table2, Trash2 } from 'lucide-react';
import type { LabelDoc } from '../doc/model';
import { appendField, batchNeeds, BUILT_IN_FIELDS, contentOf, fieldLabel, fieldsIn, type DynamicElement, type NumberSequence } from '../doc/variables';
import { IconButton } from '../ui/IconButton';
import { FieldOptions } from './FieldOptions';
import { Section, Switch } from './fields';
import { PartsEditor } from './PartsEditor';

const BUILT_IN_ICONS = { Date: CalendarDays, Time: Clock, Number: Hash };

interface DynamicProps {
  el: DynamicElement;
  doc: LabelDoc;
  onChange: (patch: Partial<DynamicElement>) => void;
  onAddSheet: () => void;
  onSequence: (sequence: NumberSequence) => void;
}

/**
 * The Dynamic section of a text, QR code or barcode: a switch in its header,
 * then the content as tags with options, and chips that add fields.
 */
export function DynamicSection({ el, doc, onChange, onAddSheet, onSequence }: DynamicProps) {
  const content = contentOf(el);
  const used = new Set(fieldsIn(content).map((f) => fieldLabel(f, doc.sheet).toLowerCase()));
  const setContent = (v: string) => onChange(el.type === 'text' ? { text: v } : { value: v });
  const chip = (name: string, icon: ReactNode, hint?: string) => (
    <button key={name} type="button" className={`chip${used.has(name.toLowerCase()) ? ' active' : ''}`} onClick={() => setContent(appendField(content, name))} title={hint ?? `Insert {{${name}}}`}>
      {icon} {name}
    </button>
  );
  return (
    <Section
      // Opens and closes with the switch.
      key={`${el.id}:${!!el.dynamic}`}
      title="Dynamic"
      id="dynamic"
      remember={false}
      defaultOpen={!!el.dynamic}
      actions={<Switch label="Dynamic" checked={!!el.dynamic} onChange={(dynamic) => onChange({ dynamic: dynamic || undefined })} />}
    >
      {el.dynamic ? (
        <div className="dynamic">
          <PartsEditor
            value={content}
            onChange={setContent}
            label={(f) => fieldLabel(f, doc.sheet)}
            options={(f, change) => <FieldOptions field={f} doc={doc} onChange={change} onSequence={onSequence} onAddSheet={onAddSheet} />}
          />
          <div className="chips" role="group" aria-label="Insert field">
            {BUILT_IN_FIELDS.map((f) => {
              const Icon = BUILT_IN_ICONS[f.name];
              return chip(f.name, <Icon size={13} />, f.hint);
            })}
            {doc.sheet?.columns.map((c) => chip(c, <Table2 size={13} />))}
            {!doc.sheet && (
              <button type="button" className="chip chip-primary" onClick={onAddSheet} title="Columns from a CSV or Excel file">
                <FileSpreadsheet size={13} /> Add sheet
              </button>
            )}
          </div>
          <p className="muted small">Click a field for its options.</p>
        </div>
      ) : (
        <p className="muted small">Fill in names, numbers and dates on each label. Switch on to start.</p>
      )}
    </Section>
  );
}

interface DataProps {
  doc: LabelDoc;
  onAddSheet: () => void;
  onDocChange: (patch: Partial<Pick<LabelDoc, 'sheet' | 'sequence'>>) => void;
}

/** The label's data: its sheet, and how {{Number}} counts. Shown with the label settings. */
export function DataSection({ doc, onAddSheet, onDocChange }: DataProps) {
  const needs = batchNeeds(doc);
  const sheet = doc.sheet;
  return (
    <Section
      key={sheet ? 'sheet' : 'none'}
      title="Data"
      remember={false}
      defaultOpen={!!sheet || needs.missing.length > 0}
      actions={
        sheet && (
          <>
            <IconButton label="Replace sheet" onClick={onAddSheet}>
              <RefreshCw size={15} />
            </IconButton>
            <IconButton label="Remove sheet" onClick={() => onDocChange({ sheet: undefined })}>
              <Trash2 size={15} />
            </IconButton>
          </>
        )
      }
    >
      {sheet ? (
        <div className="data-sheet">
          <FileSpreadsheet size={18} aria-hidden="true" />
          <div>
            <strong title={sheet.name}>{sheet.name}</strong>
            <small className="muted">
              {sheet.rows.length} {sheet.rows.length === 1 ? 'row' : 'rows'} · {sheet.columns.length} {sheet.columns.length === 1 ? 'column' : 'columns'}
            </small>
          </div>
        </div>
      ) : (
        <>
          <button className="btn btn-block" onClick={onAddSheet}>
            <FileSpreadsheet size={16} /> Add sheet
          </button>
          <p className="muted small">One label per row. Columns fill dynamic fields.</p>
        </>
      )}
      {needs.missing.length > 0 && (
        <p className="field-error">
          {sheet ? 'No column for' : 'Needs a sheet for'} {needs.missing.map((m) => `{{${m}}}`).join(', ')}
        </p>
      )}
    </Section>
  );
}
