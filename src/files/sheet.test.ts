import { parseCsv, readSheetFile, toSheet } from './sheet';

vi.mock('read-excel-file/browser', () => ({
  readSheet: async () => [
    ['Name', 'Packed'],
    ['Coffee', new Date(Date.UTC(2026, 9, 1))],
    [null, null],
    ['Tea', 42],
  ],
}));

describe('sheets', () => {
  it('reads CSV as Excel writes it: quotes, doubled quotes and line breaks', () => {
    expect(parseCsv('Name,Note\r\n"Smith, Jo","Said ""hi""\nthen left"\r\nAl,ok\r\n')).toEqual([
      ['Name', 'Note'],
      ['Smith, Jo', 'Said "hi"\nthen left'],
      ['Al', 'ok'],
    ]);
  });

  it('spots semicolons and tabs as the delimiter', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')[1]).toEqual(['1', '2']);
  });

  it('names columns from the first row and drops blank rows', () => {
    const s = toSheet('x.csv', [['Name', ''], ['Coffee', '1'], ['', ''], ['Tea']]);
    expect(s.columns).toEqual(['Name', 'Column 2']);
    expect(s.rows).toEqual([
      ['Coffee', '1'],
      ['Tea', ''],
    ]);
    expect(() => toSheet('empty.csv', [['Name']])).toThrow(/no rows/);
  });

  it('opens CSV and Excel files, and asks for old formats to be saved again', async () => {
    const csv = await readSheetFile(new File(['﻿Name\nCoffee\n'], 'items.csv'));
    expect(csv).toEqual({ name: 'items.csv', columns: ['Name'], rows: [['Coffee']] });
    const xlsx = await readSheetFile(new File([''], 'items.xlsx'));
    expect(xlsx.rows).toEqual([
      ['Coffee', new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 1)))],
      ['Tea', '42'],
    ]);
    await expect(readSheetFile(new File([''], 'old.xls'))).rejects.toThrow(/xlsx or \.csv/);
  });
});
