const niimbotConnect = vi.fn(async () => ({ deviceName: 'D110-E331024479' }));
const createBleClient = vi.fn(() => ({ connect: niimbotConnect }));
const requestPrinter = vi.fn();
vi.mock('./ble', async (real) => ({ CANDIDATE_SERVICES: (await real<typeof import('./ble')>()).CANDIDATE_SERVICES, createBleClient: (...a: unknown[]) => createBleClient(...(a as [])), requestPrinter: (...a: unknown[]) => requestPrinter(...a) }));

import { BluetoothPrinter } from './bluetooth';
import { CAT_SERVICE } from './cat';
import { CAT_MODELS } from './cat';
import { ESCPOS_ALT_SERVICE, ESCPOS_MODELS, ESCPOS_SERVICE } from './escpos';
import { TSPL_SERVICE } from './tspl';
import { MARKLIFE_SERVICE } from './marklife';

/** A Web Bluetooth device offering the given services. */
function device(name: string, services: string[]) {
  const characteristic = {
    uuid: '0000ff02-0000-1000-8000-00805f9b34fb',
    properties: { writeWithoutResponse: true, write: true },
    addEventListener: () => {},
    startNotifications: async () => {},
    writeValueWithoutResponse: vi.fn(async () => {}),
  };
  const server = {
    getPrimaryServices: async () => services.map((uuid) => ({ uuid })),
    getPrimaryService: vi.fn(async () => ({ getCharacteristic: async () => characteristic, getCharacteristics: async () => [characteristic] })),
    disconnect: () => {},
  };
  return { name, gatt: { connect: async () => server }, addEventListener: () => {} };
}

describe('bluetooth printer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists known cat printers in the chooser too', async () => {
    requestPrinter.mockResolvedValue(device('D110-E331024479', []));
    await new BluetoothPrinter(async () => ({}) as never).connect();
    expect(requestPrinter.mock.calls[0][0]).toEqual(expect.arrayContaining(['GB01', 'MX06']));
  });

  it('sends NIIMBOT printers to the NIIMBOT client with the chosen device', async () => {
    const d = device('D110-E331024479', ['e7810a71-73ae-499d-8c15-faa9aef0c3f2']);
    requestPrinter.mockResolvedValue(d);
    const printer = new BluetoothPrinter(async () => ({}) as never);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'D110-E331024479' });
    expect(createBleClient).toHaveBeenCalledWith(expect.anything(), d);
  });

  it('drives a known cat printer with the cat client', async () => {
    requestPrinter.mockResolvedValue(device('MX06-1A2B', [CAT_SERVICE]));
    const printer = new BluetoothPrinter(async () => ({}) as never);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'MX06-1A2B' });
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.getModelMetadata()).toMatchObject({ model: 'MX06', kind: 'thermal' });
    expect(typeof printer.encodePage).toBe('function');
  });

  it('falls back to the NIIMBOT client when a cat-like name lacks the cat service', async () => {
    requestPrinter.mockResolvedValue(device('MX06-odd', ['e7810a71-73ae-499d-8c15-faa9aef0c3f2']));
    await new BluetoothPrinter(async () => ({}) as never).connect();
    expect(createBleClient).toHaveBeenCalled();
  });

  it('drives a known ESC/POS printer with the ESC/POS client, even though it also offers the NIIMBOT service', async () => {
    requestPrinter.mockResolvedValue(device('MP583', ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', ESCPOS_SERVICE]));
    const printer = new BluetoothPrinter(async () => ({}) as never);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'MP583' });
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.getModelMetadata()).toMatchObject({ model: 'MP583', kind: 'thermal' });
  });

  it('passes paper feeding through for printers that cannot sense the paper, and only those', async () => {
    const printer = new BluetoothPrinter(async () => ({}) as never);
    requestPrinter.mockResolvedValue(device('MP583', [ESCPOS_SERVICE]));
    await printer.connect();
    expect(typeof printer.feedPaper).toBe('function');
    requestPrinter.mockResolvedValue(device('MX06-1A2B', [CAT_SERVICE]));
    await printer.connect();
    expect(typeof printer.feedPaper).toBe('function');
    requestPrinter.mockResolvedValue(device('QR380A-02B55B', [TSPL_SERVICE]));
    await printer.connect();
    expect(printer.feedPaper).toBeUndefined();
    requestPrinter.mockResolvedValue(device('D110-E331024479', []));
    await printer.connect();
    expect(printer.feedPaper).toBeUndefined();
  });

  it('drives an Xprinter with the ESC/POS client over the service NIIMBOT printers share', async () => {
    requestPrinter.mockResolvedValue(device('XP-58IIL', [ESCPOS_ALT_SERVICE]));
    const printer = new BluetoothPrinter(async () => ({}) as never);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'XP-58IIL' });
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.getModelMetadata()).toMatchObject({ model: 'XP-58IIL', kind: 'thermal' });
    expect(requestPrinter.mock.calls[0][0]).toContain('XP-');
  });

  it('drives a printer with a stock module name, such as an XP-58IIL showing as Printer001, over its serial service', async () => {
    const d = device('Printer001', ['0000ff00-0000-1000-8000-00805f9b34fb']);
    requestPrinter.mockResolvedValue(d);
    const printer = new BluetoothPrinter(async () => ({}) as never);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'Printer001' });
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.getModelMetadata()).toMatchObject({ model: 'Printer001', kind: 'thermal' });
    expect(typeof printer.feedPaper).toBe('function');
  });

  it('drives a known Marklife printer with the Marklife client, sending no NIIMBOT handshake', async () => {
    requestPrinter.mockResolvedValue(device('P12_ZA15B_BLE', [MARKLIFE_SERVICE, 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']));
    const printer = new BluetoothPrinter(async () => ({}) as never);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'P12_ZA15B_BLE' });
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.getModelMetadata()).toMatchObject({ model: 'P12', printheadPixels: 96, printDirection: 'left' });
    expect(printer.rollKey?.()).toBe('printer:P12_ZA15B_BLE');
    expect(printer.feedPaper).toBeUndefined();
    expect(printer.matchedAs).toBeUndefined();
  });

  it('falls back to the NIIMBOT client when a Marklife name lacks the Marklife service', async () => {
    requestPrinter.mockResolvedValue(device('P15_1A2B', ['e7810a71-73ae-499d-8c15-faa9aef0c3f2']));
    await new BluetoothPrinter(async () => ({}) as never).connect();
    expect(createBleClient).toHaveBeenCalled();
  });

  it('still sends NIIMBOT printers whose names start with P to the NIIMBOT client', async () => {
    requestPrinter.mockResolvedValue(device('P1-1234', ['e7810a71-73ae-499d-8c15-faa9aef0c3f2']));
    await new BluetoothPrinter(async () => ({}) as never).connect();
    expect(createBleClient).toHaveBeenCalled();
  });

  it('treats an unknown name as the type picked for unrecognised printers, listing every device', async () => {
    requestPrinter.mockResolvedValue(device('Mystery58', [ESCPOS_SERVICE]));
    const printer = new BluetoothPrinter(async () => ({ modelsLibrary: [] }) as never);
    printer.unrecognisedAs('escpos-80');
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'Mystery58' });
    expect(requestPrinter.mock.calls[0][1]).toBe(true);
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.getModelMetadata()).toMatchObject({ model: 'Mystery58', kind: 'thermal', printheadPixels: 576 });
  });

  it('keeps a NIIMBOT on the NIIMBOT client even with a type picked for unrecognised printers', async () => {
    const lib = async () => ({ modelsLibrary: [{ model: 'D110' }, { model: 'B21_C2B' }] }) as never;
    for (const name of ['D110-E331024479', 'B21_C2B12345']) {
      vi.clearAllMocks();
      const d = device(name, ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', ESCPOS_SERVICE]);
      requestPrinter.mockResolvedValue(d);
      const printer = new BluetoothPrinter(lib);
      printer.unrecognisedAs('escpos-58');
      await printer.connect();
      expect(createBleClient).toHaveBeenCalledWith(expect.anything(), d);
      expect(printer.feedPaper).toBeUndefined();
    }
  });

  it('says so when a printer set to a type lacks its service', async () => {
    requestPrinter.mockResolvedValue(device('Mystery', ['0000ae30-0000-1000-8000-00805f9b34fb']));
    const printer = new BluetoothPrinter(async () => ({ modelsLibrary: [] }) as never);
    printer.unrecognisedAs('tspl');
    await expect(printer.connect()).rejects.toThrow('Mystery does not offer a label printer service');
  });

  it('says when a printer offers no print service, with no printer brand in the message', async () => {
    const lib = async () => ({ modelsLibrary: [{ model: 'D110' }, { model: 'B21_C2B' }] }) as never;
    niimbotConnect.mockRejectedValueOnce(new Error('Timeout')).mockRejectedValueOnce(new Error('Timeout'));
    requestPrinter.mockResolvedValue(device('Mystery', []));
    await expect(new BluetoothPrinter(lib).connect()).rejects.toThrow('Mystery offers no print service niimai knows. See Help → Printer not recognised.');
    // A NIIMBOT that fails keeps its own error.
    niimbotConnect.mockRejectedValueOnce(new Error('Timeout'));
    requestPrinter.mockResolvedValue(device('B21-C2B123', []));
    await expect(new BluetoothPrinter(lib).connect()).rejects.toThrow('Timeout');
  });

  it('lists known ESC/POS printers in the chooser', async () => {
    requestPrinter.mockResolvedValue(device('D110-E331024479', []));
    await new BluetoothPrinter(async () => ({}) as never).connect();
    expect(requestPrinter.mock.calls[0][0]).toEqual(expect.arrayContaining(['MP583', 'PT-210']));
  });

  it('drives a TSPL label printer with the TSPL client, even though it also offers the NIIMBOT service', async () => {
    requestPrinter.mockResolvedValue(device('QR380A-02B55B', ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', TSPL_SERVICE]));
    const printer = new BluetoothPrinter(async () => ({}) as never);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'QR380A-02B55B' });
    expect(createBleClient).not.toHaveBeenCalled();
    const meta = printer.getModelMetadata() as unknown as Record<string, unknown>;
    expect(meta).toMatchObject({ model: 'QR380A', printheadPixels: 640, printDirection: 'top' });
    expect(meta.kind).toBeUndefined();
  });

  it('falls back to the NIIMBOT client when a TSPL name lacks the printer service', async () => {
    requestPrinter.mockResolvedValue(device('QR380A-odd', ['e7810a71-73ae-499d-8c15-faa9aef0c3f2']));
    await new BluetoothPrinter(async () => ({}) as never).connect();
    expect(createBleClient).toHaveBeenCalled();
  });

  it('keeps ESC/POS printers on the ESC/POS client, though TSPL printers share their service', async () => {
    requestPrinter.mockResolvedValue(device('MP583', [ESCPOS_SERVICE]));
    const printer = new BluetoothPrinter(async () => ({}) as never);
    await printer.connect();
    expect(printer.getModelMetadata()).toMatchObject({ model: 'MP583', kind: 'thermal', printheadPixels: 384 });
  });

  it('still lists every earlier printer in the chooser, plus TSPL printers', async () => {
    requestPrinter.mockResolvedValue(device('D110-E331024479', []));
    await new BluetoothPrinter(async () => ({}) as never).connect();
    const prefixes = requestPrinter.mock.calls[0][0];
    expect(prefixes).toEqual(expect.arrayContaining([...CAT_MODELS, ...ESCPOS_MODELS].map((m) => m.prefix)));
    expect(prefixes).toContain('QR380A');
  });

  const lib = async () => ({ modelsLibrary: [{ model: 'D110' }, { model: 'B21_C2B' }] }) as never;
  const MTP_SERVICES = ['49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000ff00-0000-1000-8000-00805f9b34fb', ESCPOS_SERVICE];
  /** NIIMBOT's handshake fails this many times in a row. */
  const niimbotMisses = (n: number) => {
    for (let i = 0; i < n; i++) niimbotConnect.mockRejectedValueOnce(new Error('Unable to perform initial negotiate: Timeout'));
  };

  it('still tries NIIMBOT first for every unknown name, whatever it offers, so nothing that worked before changes', async () => {
    for (const services of [MTP_SERVICES, [ESCPOS_SERVICE], [CAT_SERVICE], ['0000ff00-0000-1000-8000-00805f9b34fb'], []]) {
      vi.clearAllMocks();
      const d = device('Mystery-1', services);
      requestPrinter.mockResolvedValue(d);
      await expect(new BluetoothPrinter(lib).connect()).resolves.toEqual({ deviceName: 'D110-E331024479' });
      expect(createBleClient).toHaveBeenCalledWith(expect.anything(), d);
      expect(niimbotConnect).toHaveBeenCalledTimes(1);
    }
  });

  it('gives an unknown NIIMBOT that misses one handshake a second try on NIIMBOT', async () => {
    niimbotMisses(1);
    requestPrinter.mockResolvedValue(device('Mystery-1', MTP_SERVICES));
    const printer = new BluetoothPrinter(lib);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'D110-E331024479' });
    expect(niimbotConnect).toHaveBeenCalledTimes(2);
    expect(printer.feedPaper).toBeUndefined();
  });

  it('drives an unknown receipt printer that offers the NIIMBOT service beside the printer service, as a receipt printer once NIIMBOT fails twice', async () => {
    niimbotMisses(2);
    requestPrinter.mockResolvedValue(device('Generic-4B_6DEF', MTP_SERVICES));
    const printer = new BluetoothPrinter(lib);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'Generic-4B_6DEF' });
    expect(niimbotConnect).toHaveBeenCalledTimes(2);
    expect(printer.getModelMetadata()).toMatchObject({ model: 'Generic-4B_6DEF', kind: 'thermal', printheadPixels: 384 });
    // Matched by its services, its head's width is a guess the paper can correct.
    expect(printer.headUnknown).toBe(true);
    printer.setHeadDots!(576);
    expect(printer.getModelMetadata()).toMatchObject({ printheadPixels: 576 });
  });

  it('falls back by services: cat service to a cat printer, other serial services to a receipt printer', async () => {
    for (const [services, model] of [
      [[CAT_SERVICE], 'Kitty-01'],
      [['0000ff00-0000-1000-8000-00805f9b34fb'], 'Mystery-2'],
      [['49535343-fe7d-4ae5-8fa9-9fafd205e455'], 'Mystery-3'],
    ] as [string[], string][]) {
      vi.clearAllMocks();
      niimbotMisses(2);
      requestPrinter.mockResolvedValue(device(model, services));
      const printer = new BluetoothPrinter(lib);
      await expect(printer.connect()).resolves.toEqual({ deviceName: model });
      expect(printer.getModelMetadata()).toMatchObject({ model, kind: 'thermal' });
    }
  });

  it('never hands a printer offering only NIIMBOT services to another client', async () => {
    for (const service of ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', '0000e0ff-3c17-d293-8e48-14fe2e4da212']) {
      vi.clearAllMocks();
      niimbotMisses(2);
      requestPrinter.mockResolvedValue(device('Mystery-1', [service]));
      await expect(new BluetoothPrinter(lib).connect()).rejects.toThrow('Could not connect to Mystery-1. Pick its type under Advanced and connect again.');
    }
  });

  it('never sends a NIIMBOT-named printer anywhere but NIIMBOT, and passes on its own error at once', async () => {
    for (const name of ['D110-E331024479', 'B21_C2B12345']) {
      vi.clearAllMocks();
      niimbotMisses(1);
      const d = device(name, MTP_SERVICES);
      requestPrinter.mockResolvedValue(d);
      await expect(new BluetoothPrinter(lib).connect()).rejects.toThrow('Unable to perform initial negotiate');
      expect(niimbotConnect).toHaveBeenCalledTimes(1);
      expect(createBleClient).toHaveBeenCalledWith(expect.anything(), d);
    }
  });

  it('writes through any writable characteristic when the standard one is missing', async () => {
    niimbotMisses(2);
    const d = device('Generic-4B_6DEF', [ESCPOS_SERVICE]);
    const server = await d.gatt.connect();
    const getService = server.getPrimaryService as unknown as import("vitest").Mock<(uuid: string) => Promise<{ getCharacteristic: (uuid: string) => Promise<unknown>; getCharacteristics: () => Promise<{ uuid: string }[]> }>>;
    const chars = await (await getService(ESCPOS_SERVICE)).getCharacteristics();
    getService.mockImplementation(async () => ({
      getCharacteristic: async (uuid: string) => {
        if (uuid !== chars[0].uuid) throw new Error('No Characteristics matching UUID');
        return chars[0];
      },
      getCharacteristics: async () => chars,
    }));
    d.gatt.connect = async () => server;
    requestPrinter.mockResolvedValue(d);
    await expect(new BluetoothPrinter(lib).connect()).resolves.toEqual({ deviceName: 'Generic-4B_6DEF' });
  });

  /** Every byte written to the device's characteristic. */
  const written = async (d: ReturnType<typeof device>) => {
    const server = await d.gatt.connect();
    const ch = await (await (server.getPrimaryService as unknown as (u: string) => Promise<{ getCharacteristic: () => Promise<{ writeValueWithoutResponse: { mock: { calls: [ArrayBuffer][] } } }> }>)(ESCPOS_SERVICE)).getCharacteristic();
    return ch.writeValueWithoutResponse.mock.calls.flatMap(([b]) => Array.from(new Uint8Array(b)));
  };

  it('prints the NIIMBOT tries out of the buffer right after matching a receipt printer, and reports the match', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    niimbotMisses(2);
    const d = device('Generic-4B_6DEF', MTP_SERVICES);
    requestPrinter.mockResolvedValue(d);
    const printer = new BluetoothPrinter(lib);
    await printer.connect();
    expect(printer.matchedAs).toBe('escpos');
    expect(await written(d)).toEqual([0x1c, 0x2e, 0x0a, 0x0a, 0x1b, 0x40]);
  });

  it('connects a printer matched before straight to its client, sending no NIIMBOT handshake', async () => {
    const d = device('Generic-4B_6DEF', MTP_SERVICES);
    requestPrinter.mockResolvedValue(d);
    const printer = new BluetoothPrinter(lib);
    printer.rememberMatches({ 'Generic-4B_6DEF': 'escpos' });
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'Generic-4B_6DEF' });
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.matchedAs).toBe('escpos');
    expect(printer.getModelMetadata()).toMatchObject({ model: 'Generic-4B_6DEF', kind: 'thermal' });
    expect(await written(d)).toEqual([]);
  });

  it('never applies a remembered match to a NIIMBOT name, a known printer or another name', async () => {
    for (const [name, services] of [
      ['D110-E331024479', MTP_SERVICES],
      ['MP583', [ESCPOS_SERVICE]],
      ['Mystery-1', MTP_SERVICES],
    ] as [string, string[]][]) {
      vi.clearAllMocks();
      requestPrinter.mockResolvedValue(device(name, services));
      const printer = new BluetoothPrinter(lib);
      printer.rememberMatches({ 'D110-E331024479': 'escpos', MP583: 'cat', 'Generic-4B_6DEF': 'escpos' });
      await printer.connect();
      expect(printer.matchedAs).toBeUndefined();
      if (name === 'MP583') expect(printer.getModelMetadata()).toMatchObject({ model: 'MP583' });
      else expect(createBleClient).toHaveBeenCalled();
    }
  });

  it('knows the MTP-4B by name: it goes straight to the receipt client, so no NIIMBOT handshake prints as text', async () => {
    const d = device('MTP-4B_6DEF', MTP_SERVICES);
    requestPrinter.mockResolvedValue(d);
    const printer = new BluetoothPrinter(lib);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'MTP-4B_6DEF' });
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.matchedAs).toBeUndefined();
    expect(printer.headUnknown).toBe(false);
    expect(printer.getModelMetadata()).toMatchObject({ model: 'MTP-4B_6DEF', kind: 'thermal', printheadPixels: 576 });
    expect(await written(d)).toEqual([]);
  });

  it('skips the NIIMBOT handshake for unknown names when told to, matching by services with nothing to flush', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const d = device('Generic-4B_6DEF', MTP_SERVICES);
    requestPrinter.mockResolvedValue(d);
    const printer = new BluetoothPrinter(lib);
    printer.niimbotHandshake(false);
    await expect(printer.connect()).resolves.toEqual({ deviceName: 'Generic-4B_6DEF' });
    expect(createBleClient).not.toHaveBeenCalled();
    expect(printer.matchedAs).toBe('escpos');
    expect(await written(d)).toEqual([]);
  });

  it('asks a handshake function about each unknown name, and only those', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const policy = vi.fn((name: string | undefined) => name !== 'Generic-4B_6DEF');
    for (const [name, handshake] of [
      ['Generic-4B_6DEF', false],
      ['Mystery-1', true],
    ] as const) {
      vi.clearAllMocks();
      requestPrinter.mockResolvedValue(device(name, MTP_SERVICES));
      const printer = new BluetoothPrinter(lib);
      printer.niimbotHandshake(policy);
      await printer.connect();
      expect(policy).toHaveBeenCalledWith(name);
      expect(createBleClient).toHaveBeenCalledTimes(handshake ? 1 : 0);
    }
  });

  it('always gives NIIMBOT names the handshake, and leaves known printers alone, whatever the policy', async () => {
    requestPrinter.mockResolvedValue(device('D110-E331024479', MTP_SERVICES));
    const niimbot = new BluetoothPrinter(lib);
    niimbot.niimbotHandshake(false);
    await niimbot.connect();
    expect(createBleClient).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    requestPrinter.mockResolvedValue(device('MP583', [ESCPOS_SERVICE]));
    const known = new BluetoothPrinter(lib);
    known.niimbotHandshake(false);
    await known.connect();
    expect(createBleClient).not.toHaveBeenCalled();
    expect(known.getModelMetadata()).toMatchObject({ model: 'MP583' });
  });

  it('says when a printer skipping the handshake offers nothing to print through', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    requestPrinter.mockResolvedValue(device('Mystery-1', []));
    const printer = new BluetoothPrinter(lib);
    printer.niimbotHandshake(false);
    await expect(printer.connect()).rejects.toThrow('offers no print service niimai knows');
    expect(createBleClient).not.toHaveBeenCalled();
  });
});
