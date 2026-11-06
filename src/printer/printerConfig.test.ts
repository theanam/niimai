import { configSummary, EMPTY_SETTINGS, mergeConfig, parseConfig, serializeConfig, type PrinterSettings } from './printerConfig';

const settings: PrinterSettings = {
  manualProfileId: 'escpos-80',
  density: 3,
  rollSizes: { '6972842743589': { widthMm: 50, heightMm: 30 } },
  printOffsets: { 'MTP-4B_6DEF': { x: 1, y: 0 } },
  stickerGaps: { 'MTP-4B_6DEF': 2 },
  paperWidths: { 'MTP-4B_6DEF': 50 },
  labelLengths: { 'MTP-4B_6DEF': 30 },
  matchedPrinters: { 'MTP-4B_6DEF': 'escpos' },
  paperPresets: [{ id: 'a', name: 'Kraft 50 × 30', widthMm: 50, lengthMm: 30, gapMm: 2 }],
  paperChoices: { 'MTP-4B_6DEF': 'a' },
};

describe('printer settings file', () => {
  it('saves every printer setting and reads it back unchanged', () => {
    const text = serializeConfig(settings, new Date('2026-11-07T00:00:00Z'));
    expect(JSON.parse(text)).toMatchObject({ kind: 'niimai-printers', version: 1, savedAt: '2026-11-07T00:00:00.000Z' });
    expect(parseConfig(text)).toEqual(settings);
  });

  it('refuses other files, and files from a newer version', () => {
    expect(() => parseConfig('not json')).toThrow('Not a printer settings file');
    expect(() => parseConfig(JSON.stringify({ version: 1, elements: [] }))).toThrow('Not a printer settings file');
    expect(() => parseConfig(JSON.stringify({ kind: 'niimai-printers', version: 2 }))).toThrow('newer niimai');
  });

  it('drops broken entries and keeps the rest', () => {
    const loaded = parseConfig(
      JSON.stringify({
        kind: 'niimai-printers',
        version: 1,
        density: 'dark',
        printOffsets: { A: { x: 1, y: 2 }, B: { x: 'left' } },
        stickerGaps: { A: 2, B: -1 },
        matchedPrinters: { A: 'escpos', B: 'niimbot' },
        paperPresets: [{ id: 'a', name: 'Good', widthMm: 58, lengthMm: 30 }, { id: 'b', name: '', widthMm: 58, lengthMm: 30 }, { id: 'a', name: 'Twin', widthMm: 58, lengthMm: 30 }],
      }),
    );
    expect(loaded.density).toBeUndefined();
    expect(loaded.printOffsets).toEqual({ A: { x: 1, y: 2 } });
    expect(loaded.stickerGaps).toEqual({ A: 2 });
    expect(loaded.matchedPrinters).toEqual({ A: 'escpos' });
    expect(loaded.paperPresets.map((p) => p.name)).toEqual(['Good']);
    expect(loaded.rollSizes).toEqual({});
  });

  it('adds a loaded file to what is there: the file wins, and nothing it leaves out is lost', () => {
    const current: PrinterSettings = {
      ...EMPTY_SETTINGS,
      density: 2,
      printOffsets: { 'MP583': { x: 0.5, y: 0 }, 'MTP-4B_6DEF': { x: 0, y: 0 } },
      paperWidths: { MP583: 48 },
      paperPresets: [
        { id: 'a', name: 'Old name', widthMm: 40, lengthMm: 30 },
        { id: 'z', name: 'Mine', widthMm: 58, lengthMm: 40 },
      ],
    };
    const next = mergeConfig(current, settings);
    expect(next.density).toBe(3);
    expect(next.manualProfileId).toBe('escpos-80');
    expect(next.printOffsets).toEqual({ MP583: { x: 0.5, y: 0 }, 'MTP-4B_6DEF': { x: 1, y: 0 } });
    expect(next.paperWidths).toEqual({ MP583: 48, 'MTP-4B_6DEF': 50 });
    expect(next.paperPresets.map((p) => p.name).sort()).toEqual(['Kraft 50 × 30', 'Mine']);
  });

  it('takes continuous paper from the file for a printer it covers, keeping other printers’ stickers', () => {
    const current: PrinterSettings = { ...EMPTY_SETTINGS, stickerGaps: { 'MTP-4B_6DEF': 3, MP583: 2 } };
    const loaded: PrinterSettings = { ...EMPTY_SETTINGS, paperWidths: { 'MTP-4B_6DEF': 75 } };
    expect(mergeConfig(current, loaded).stickerGaps).toEqual({ MP583: 2 });
  });

  it('keeps the printer type set when the file has none', () => {
    const next = mergeConfig({ ...EMPTY_SETTINGS, manualProfileId: 'tspl' }, { ...EMPTY_SETTINGS });
    expect(next.manualProfileId).toBe('tspl');
  });

  it('says what a file held', () => {
    expect(configSummary(settings)).toBe('1 printer, 1 paper');
    expect(configSummary(EMPTY_SETTINGS)).toBe('no printer settings');
  });
});
