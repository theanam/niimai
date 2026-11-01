const niimbotConnect = vi.fn(async () => ({ deviceName: 'D110-E331024479' }));
const createBleClient = vi.fn(() => ({ connect: niimbotConnect }));
const requestPrinter = vi.fn();
vi.mock('./ble', () => ({ createBleClient: (...a: unknown[]) => createBleClient(...(a as [])), requestPrinter: (...a: unknown[]) => requestPrinter(...a) }));

import { BluetoothPrinter } from './bluetooth';
import { CAT_SERVICE } from './cat';
import { CAT_MODELS } from './cat';
import { ESCPOS_MODELS, ESCPOS_SERVICE } from './escpos';
import { TSPL_SERVICE } from './tspl';

/** A Web Bluetooth device offering the given services. */
function device(name: string, services: string[]) {
  const characteristic = {
    properties: { writeWithoutResponse: true, write: true },
    addEventListener: () => {},
    startNotifications: async () => {},
    writeValueWithoutResponse: vi.fn(async () => {}),
  };
  const server = {
    getPrimaryServices: async () => services.map((uuid) => ({ uuid })),
    getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }),
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
