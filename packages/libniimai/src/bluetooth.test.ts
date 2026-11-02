const niimbotConnect = vi.fn(async () => ({ deviceName: 'D110-E331024479' }));
const createBleClient = vi.fn(() => ({ connect: niimbotConnect }));
const requestPrinter = vi.fn();
vi.mock('./ble', async (real) => ({ CANDIDATE_SERVICES: (await real<typeof import('./ble')>()).CANDIDATE_SERVICES, createBleClient: (...a: unknown[]) => createBleClient(...(a as [])), requestPrinter: (...a: unknown[]) => requestPrinter(...a) }));

import { BluetoothPrinter } from './bluetooth';
import { CAT_SERVICE } from './cat';
import { CAT_MODELS } from './cat';
import { ESCPOS_ALT_SERVICE, ESCPOS_MODELS, ESCPOS_SERVICE } from './escpos';
import { TSPL_SERVICE } from './tspl';

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

  it('points to the printer type when an unknown name does not answer as a NIIMBOT', async () => {
    const lib = async () => ({ modelsLibrary: [{ model: 'D110' }, { model: 'B21_C2B' }] }) as never;
    niimbotConnect.mockRejectedValueOnce(new Error('Timeout'));
    requestPrinter.mockResolvedValue(device('Mystery', []));
    await expect(new BluetoothPrinter(lib).connect()).rejects.toThrow('pick its type under Advanced');
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
});
