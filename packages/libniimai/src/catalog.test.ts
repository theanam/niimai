import { modelsLibrary } from '@mmote/niimbluelib';
import { findPrinterType, identifyPrinter, PRINTER_CATALOG, PRINTER_TYPES } from './catalog';

describe('printer catalog', () => {
  it('gives every prefix to one family only', () => {
    const prefixes = PRINTER_CATALOG.map((e) => e.model.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('never claims a NIIMBOT printer', () => {
    // Bluetooth names of NIIMBOT printers start with the model, as in "D110-E331024479" or "B21_C2B…".
    for (const { model } of modelsLibrary) {
      for (const name of [`${model.replace(/_/g, '-')}-E331024479`, `${model}_1234`]) expect(identifyPrinter(name), name).toBeNull();
    }
  });

  it('matches the longest prefix across families', () => {
    expect(identifyPrinter('MP583')).toMatchObject({ family: 'escpos', model: { prefix: 'MP583' } });
    expect(identifyPrinter('MP58A')).toMatchObject({ family: 'escpos', model: { prefix: 'MP58' } });
    expect(identifyPrinter('QR380A-02B55B')).toMatchObject({ family: 'tspl' });
    expect(identifyPrinter('MX06-1A2B')).toMatchObject({ family: 'cat' });
    expect(identifyPrinter('Printer001')).toMatchObject({ family: 'escpos' });
    // 80 mm models print on a wider head; stock module names keep the 58 mm default.
    expect(identifyPrinter('MPT-3F')?.model).toMatchObject({ prefix: 'MPT-3', headDots: 576 });
    expect(identifyPrinter('BlueTooth Printer')?.model.headDots).toBeUndefined();
    expect(identifyPrinter('GP-M322')).toMatchObject({ family: 'tspl' });
    expect(identifyPrinter('Mystery')).toBeNull();
    expect(identifyPrinter(undefined)).toBeNull();
  });

  it('offers a type for each family, with 80 mm receipt printers on a wider head', () => {
    expect(new Set(PRINTER_TYPES.map((t) => t.family))).toEqual(new Set(['escpos', 'tspl', 'cat']));
    expect(findPrinterType('escpos-80')?.model.headDots).toBe(576);
    expect(findPrinterType('b21')).toBeNull();
  });

  it('keeps every model it has shipped: same family, same name shown, so saved settings still find it', () => {
    const shipped = {
      escpos: ['MP583', 'MPT-II', 'MP58', 'MTP-II', 'PT-210', 'PT-200', 'RPP02', 'ZJ-58'],
      tspl: ['QR380A'],
      cat: ['GB01', 'GB02', 'GB03', 'MX05', 'MX06', 'MX10', 'MX08', 'MX09', 'MX11', 'GT01', 'YT01', 'PD01', 'MXTP', 'SC03h'],
    };
    for (const [family, prefixes] of Object.entries(shipped)) {
      for (const prefix of prefixes) {
        expect(identifyPrinter(`${prefix}-1A2B`), prefix).toMatchObject({ family, model: { prefix } });
        expect(identifyPrinter(`${prefix}-1A2B`)?.model.generic, prefix).toBeFalsy();
      }
    }
  });
});
