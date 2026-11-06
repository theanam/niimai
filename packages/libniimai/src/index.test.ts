import type { ThermalTransport } from './thermal';

const lib = { loads: 0 };
// Each test loads the library afresh, so niimbluelib counts as loaded only when that test loads it.
let libniimai: typeof import('./index');
const DEMO_NAME = 'Demo printer';

/** An in-memory link that keeps every byte written to it. */
function memoryLink() {
  const bytes: number[] = [];
  const link: ThermalTransport = {
    name: DEMO_NAME,
    write: async (chunk) => void bytes.push(...chunk),
    onNotify: () => {},
    onDisconnect: () => {},
    disconnect: async () => {},
  };
  return { link, bytes };
}

/** A 48 × 10 mm page, all black. */
function page() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 384, height: 80 });
  const ink = { getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  vi.spyOn(canvas, 'getContext').mockReturnValue(ink as never);
  return canvas;
}

beforeEach(async () => {
  vi.resetModules();
  lib.loads = 0;
  vi.doMock('@mmote/niimbluelib', () => {
    lib.loads++;
    return {
      NiimbotSerialClient: class NiimbotSerialClient {},
      ImageEncoder: { encodeCanvas: () => ({ encoded: true }) },
    };
  });
  libniimai = await import('./index');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('createPrinter', () => {
  it('connects the built-in demo printer when given no options', async () => {
    const { createPrinter } = libniimai;
    const printer = createPrinter();
    await printer.connect('demo');
    expect(printer.getStatus()).toMatchObject({ state: 'ready', deviceName: DEMO_NAME, profile: { name: DEMO_NAME } });
    expect(printer.getStatus().profile?.kind).toBeUndefined();
  });

  it('takes a NIIMBOT handshake policy for Bluetooth printers', async () => {
    const { createPrinter, MockClient } = libniimai;
    const custom = Object.assign(new MockClient(), { niimbotHandshake: vi.fn() });
    const printer = createPrinter({ createClient: async () => custom, niimbotHandshake: false });
    await printer.connect('bluetooth');
    expect(custom.niimbotHandshake).toHaveBeenCalledWith(false);
  });

  it('makes each connection with a custom client factory', async () => {
    const { createPrinter, MockClient } = libniimai;
    const custom = new MockClient();
    const factory = vi.fn(async () => custom);
    const printer = createPrinter({ createClient: factory });
    await printer.connect('bluetooth');
    expect(factory).toHaveBeenCalledWith('bluetooth');
    expect(custom.isConnected()).toBe(true);
    await printer.print(page(), { density: 2, copies: 2 });
    expect(custom.printed).toHaveLength(1);
    expect(custom.printed[0].quantity).toBe(2);
    // Its pages went through niimbluelib's encoder, which loads on first use.
    expect(lib.loads).toBe(1);
  });

  it('prints through a custom thermal client’s own encoder, without loading niimbluelib', async () => {
    const { createPrinter, EscPosPrinterClient } = libniimai;
    const { link, bytes } = memoryLink();
    const printer = createPrinter({ createClient: async () => new EscPosPrinterClient(link, null, { chunkMs: 0, pauseMs: 1 }) });
    await printer.connect('demo');
    // The demo keeps its name, and takes the stand-in's paper and head.
    expect(printer.getStatus().profile).toMatchObject({ name: DEMO_NAME, kind: 'thermal', printheadPixels: 384 });
    await printer.print(page(), { density: 1, copies: 1 });
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(bytes.length).toBeGreaterThan(48 * 80);
    expect(lib.loads).toBe(0);
  });

  it('can wrap the default, so other connections keep the built-in clients', async () => {
    const { BluetoothPrinter, createClient, EscPosPrinterClient } = libniimai;
    const { link } = memoryLink();
    const demo = new EscPosPrinterClient(link, null, { chunkMs: 0, pauseMs: 1 });
    const factory = (kind: 'bluetooth' | 'serial' | 'demo') => (kind === 'demo' ? Promise.resolve(demo) : createClient(kind));
    expect(await factory('demo')).toBe(demo);
    expect(await factory('bluetooth')).toBeInstanceOf(BluetoothPrinter);
    expect(lib.loads).toBe(0);
    const serial = await factory('serial');
    expect(serial.constructor.name).toBe('NiimbotSerialClient');
    expect(lib.loads).toBe(1);
  });
});
