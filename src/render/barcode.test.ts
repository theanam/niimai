import { createDoc, createElement, type BarcodeElement } from '../doc/model';
import { barcodeSymbol, qrSymbol, symbolError } from './barcode';

describe('barcodes', () => {
  const doc = createDoc();

  it('encodes QR codes', () => {
    const sym = qrSymbol({ value: 'hello' });
    expect(sym.viewBox).toMatch(/^0 0 \d+ \d+$/);
    expect(sym.body).toContain('<path');
  });

  it('encodes each supported format', () => {
    expect(() => barcodeSymbol({ format: 'code128', value: 'ABC-123', showText: true })).not.toThrow();
    expect(() => barcodeSymbol({ format: 'code39', value: 'ABC', showText: false })).not.toThrow();
    expect(() => barcodeSymbol({ format: 'ean13', value: '590123412345', showText: true })).not.toThrow();
    expect(() => barcodeSymbol({ format: 'upca', value: '03600029145', showText: true })).not.toThrow();
  });

  it('reports invalid values without the encoder prefix', () => {
    const el = { ...(createElement('barcode', doc) as BarcodeElement), format: 'ean13' as const, value: 'nope' };
    const err = symbolError(el);
    expect(err).toBeTruthy();
    expect(err).not.toMatch(/^bwipp/);
  });

  it('reports no error for valid values', () => {
    expect(symbolError(createElement('qr', doc) as never)).toBeNull();
  });
});
