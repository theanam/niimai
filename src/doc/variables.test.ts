import { createDoc, createElement, type LabelDoc, type TextElement } from './model';
import { appendField, batchNeeds, clampRange, fieldLabel, fieldName, fieldsIn, fieldsOf, fill, formatDate, formatTime, fromParts, isBatch, parseField, resolveDoc, sequenceCount, sequenceValue, toParts } from './variables';

const now = new Date(2026, 9, 30, 14, 5);
const day = (d: Date) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);

const sheet = { name: 'items.csv', columns: ['Name', 'SKU'], rows: [['Coffee', '100'], ['Tea', '200']] };

function labelWith(text: string, extra: Partial<LabelDoc> = {}, dynamic = true): LabelDoc {
  const doc = createDoc();
  const el = { ...(createElement('text', doc) as TextElement), text, dynamic };
  return { ...doc, ...extra, elements: [el] };
}

describe('dynamic fields', () => {
  it('finds fields written in text, once each', () => {
    expect(fieldsIn('{{Name}} – {{ SKU }} ({{Name}})')).toEqual(['Name', 'SKU']);
    expect(fieldsIn('No fields {here}')).toEqual([]);
  });

  it('only counts fields in elements marked dynamic', () => {
    expect(fieldsOf(labelWith('{{Name}}', {}, false))).toEqual([]);
    expect(fieldsOf(labelWith('{{Name}}'))).toEqual(['Name']);
  });

  it('fills sheet columns for a row, matching names without regard to case', () => {
    expect(fill('{{name}}: {{SKU}}', { sheet }, { index: 1, now })).toBe('Tea: 200');
  });

  it('counts numbers with a start, step and padding', () => {
    expect(sequenceValue({ start: 1, step: 1, digits: 3 }, 0)).toBe('001');
    expect(sequenceValue({ start: 100, step: 10, digits: 1 }, 2)).toBe('120');
    expect(sequenceValue(undefined, 4)).toBe('5');
    expect(fill('SN-{{Number}}', { sequence: { start: 7, step: 1, digits: 4 } }, { index: 1, now })).toBe('SN-0008');
  });

  it('fills today, a day count from today, and the time', () => {
    const later = new Date(now);
    later.setDate(later.getDate() + 30);
    expect(fill('{{Date}}', {}, { index: 0, now })).toBe(day(now));
    expect(fill('Best before {{Date+30}}', {}, { index: 0, now })).toBe(`Best before ${day(later)}`);
    expect(fill('{{Time}}', {}, { index: 0, now })).toBe(new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(now));
  });

  it('leaves fields it cannot fill as written, so they are easy to spot', () => {
    expect(fill('{{Address}}', { sheet }, { index: 0, now })).toBe('{{Address}}');
  });

  it('prefers a sheet column over a built-in field of the same name', () => {
    const dated = { name: 'd', columns: ['Date'], rows: [['Monday']] };
    expect(fill('{{Date}}', { sheet: dated }, { index: 0, now })).toBe('Monday');
  });

  it('resolves only dynamic elements and keeps the label as written otherwise', () => {
    const doc = labelWith('{{Name}}', { sheet });
    expect((resolveDoc(doc, { index: 0, now }).elements[0] as TextElement).text).toBe('Coffee');
    expect((doc.elements[0] as TextElement).text).toBe('{{Name}}');
    const plain = labelWith('{{Name}}', { sheet }, false);
    expect(resolveDoc(plain, { index: 0, now })).toBe(plain);
  });

  it('works out what a batch needs', () => {
    expect(isBatch(labelWith('{{Date}}'))).toBe(false);
    expect(batchNeeds(labelWith('SN-{{Number}}'))).toMatchObject({ number: true, sheet: false, missing: [] });
    expect(batchNeeds(labelWith('{{Name}}'))).toMatchObject({ sheet: false, missing: ['Name'] });
    expect(batchNeeds(labelWith('{{Name}} {{Colour}}', { sheet }))).toMatchObject({ sheet: true, missing: ['Colour'] });
  });

  it('adds a field to the end of a text', () => {
    expect(appendField('', 'Name')).toBe('{{Name}}');
    expect(appendField('SN-', 'Number')).toBe('SN- {{Number}}');
    expect(appendField('Line\n', 'Date')).toBe('Line\n{{Date}}');
  });

  it('keeps a row range inside the sheet', () => {
    expect(clampRange(0, 500, 20)).toEqual([1, 20]);
    expect(clampRange(8, 3, 20)).toEqual([8, 8]);
  });

  it('splits content into words and fields, and joins it back', () => {
    const text = 'SN-{{Number}} / {{ Name }}\nend';
    expect(toParts(text)).toEqual([
      { kind: 'text', value: 'SN-' },
      { kind: 'field', name: 'Number' },
      { kind: 'text', value: ' / ' },
      { kind: 'field', name: 'Name' },
      { kind: 'text', value: '\nend' },
    ]);
    expect(fromParts(toParts(text))).toBe('SN-{{Number}} / {{Name}}\nend');
    expect(toParts('')).toEqual([]);
  });

  it('reads and writes field options, leaving defaults off', () => {
    expect(parseField('Date+30:iso')).toEqual({ kind: 'date', name: 'Date', offset: 30, format: 'iso' });
    expect(parseField('Time:12h')).toMatchObject({ kind: 'time', format: '12h' });
    expect(parseField('Number')).toMatchObject({ kind: 'number' });
    expect(parseField('Ship to')).toMatchObject({ kind: 'column', name: 'Ship to' });
    expect(fieldName({ kind: 'date', name: 'Date', offset: -7, format: 'mmyy' })).toBe('Date-7:mmyy');
    expect(fieldName({ kind: 'date', name: 'Date', offset: 0, format: 'medium' })).toBe('Date');
    expect(fieldName({ kind: 'time', name: 'Time', offset: 0, format: 'local' })).toBe('Time');
    expect(fieldLabel('Date+30:iso')).toBe('Date +30');
  });

  it('writes dates and times in the chosen format', () => {
    expect(formatDate(now, 'iso')).toBe('2026-10-30');
    expect(formatDate(now, 'mmyy')).toBe('10/2026');
    expect(formatTime(now, '24h')).toBe('14:05');
    expect(formatTime(now, '12h')).toBe('2:05 PM');
    expect(fill('Use by {{Date+2:iso}}', {}, { index: 0, now })).toBe('Use by 2026-11-01');
  });

  it('counts the labels a numbered range covers', () => {
    expect(sequenceCount({ start: 1, step: 1, digits: 1, end: 100 })).toBe(100);
    expect(sequenceCount({ start: 10, step: 5, digits: 1, end: 30 })).toBe(5);
    expect(sequenceCount({ start: 1, step: 1, digits: 1 })).toBeNull();
  });
});
