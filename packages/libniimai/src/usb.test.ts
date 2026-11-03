import { familiesFromDeviceId, parseDeviceId, UsbPrinter } from './usb';
import { identifyUsbPrinter } from './catalog';
import { supportIssue } from './client';

const CC390_ID = 'MANUFACTURER:;COMMAND SET:TSC/ESC/POS;MODEL:CC390;COMMENT:gz-printer;ACTIVE COMMAND:TSC/ESC/POS;';

/** A USB printer as WebUSB shows it: one printer interface with bulk out and in, and a device ID. */
function fakePrinter({ vendorId = 0x28e9, productId = 0x0289, productName = 'CC390', deviceId = CC390_ID } = {}) {
  const written: Uint8Array[] = [];
  const replies: Uint8Array[] = [];
  let waiting: ((d: Uint8Array | null) => void) | null = null;
  const reply = (bytes: number[]) => (waiting ? (waiting(Uint8Array.from(bytes)), (waiting = null)) : replies.push(Uint8Array.from(bytes)));
  const idBytes = new TextEncoder().encode(deviceId);
  const alt = {
    alternateSetting: 0,
    interfaceClass: 7,
    endpoints: [
      { endpointNumber: 1, direction: 'out', type: 'bulk', packetSize: 64 },
      { endpointNumber: 1, direction: 'in', type: 'bulk', packetSize: 64 },
    ],
  };
  const device = {
    vendorId,
    productId,
    productName,
    configuration: { interfaces: [{ interfaceNumber: 0, alternates: [alt], alternate: alt }] },
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    selectConfiguration: vi.fn(async () => {}),
    claimInterface: vi.fn(async () => {}),
    releaseInterface: vi.fn(async () => {}),
    selectAlternateInterface: vi.fn(async () => {}),
    controlTransferIn: vi.fn(async () => {
      const data = new Uint8Array(idBytes.length + 2);
      data[0] = (data.length >> 8) & 0xff;
      data[1] = data.length & 0xff;
      data.set(idBytes, 2);
      return { status: 'ok', data: new DataView(data.buffer) };
    }),
    transferOut: vi.fn(async (_ep: number, data: Uint8Array) => {
      written.push(data);
      return { status: 'ok', bytesWritten: data.length };
    }),
    transferIn: vi.fn(
      () =>
        new Promise<{ status: string; data: DataView } | null>((resolve) => {
          const next = replies.shift();
          const done = (d: Uint8Array | null) => resolve(d ? { status: 'ok', data: new DataView(d.buffer) } : null);
          if (next) done(next);
          else waiting = done;
        }),
    ),
  };
  return { device, written, reply, sent: () => new TextDecoder('latin1').decode(Uint8Array.from(written.flatMap((w) => [...w]))) };
}

function installUsb(devices: unknown[], chosen?: unknown) {
  const usb = {
    getDevices: vi.fn(async () => devices),
    requestDevice: vi.fn(async () => chosen ?? devices[0]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'usb', { value: usb, configurable: true });
  return usb;
}

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).usb;
});

describe('USB printers', () => {
  it('reads the printer language from an IEEE 1284 device ID', () => {
    expect(parseDeviceId(CC390_ID)).toMatchObject({ 'COMMAND SET': 'TSC/ESC/POS', MODEL: 'CC390' });
    expect(familiesFromDeviceId(CC390_ID)).toEqual(['tspl', 'escpos']);
    expect(familiesFromDeviceId('MFG:EPSON;CMD:ESC/POS;MDL:TM-T20;')).toEqual(['escpos']);
    expect(familiesFromDeviceId('MFG:Zebra;CMD:ZPL;')).toEqual([]);
  });

  it('knows the CC390 by its USB IDs as the same QR380A model it is over Bluetooth', () => {
    expect(identifyUsbPrinter({ vendorId: 0x28e9, productId: 0x0289, productName: 'CC390' })?.model.prefix).toBe('QR380A');
    expect(identifyUsbPrinter({ vendorId: 1, productId: 2, productName: 'Mystery' })).toBeNull();
  });

  it('asks the browser for a USB printer and prints TSPL to it in large writes', async () => {
    const { device, sent, written, reply } = fakePrinter();
    const usb = installUsb([], device);
    const printer = new UsbPrinter();
    expect(await printer.connect()).toEqual({ deviceName: 'CC390' });
    expect(usb.requestDevice).toHaveBeenCalledWith({ filters: [{ classCode: 7 }] });
    expect(device.claimInterface).toHaveBeenCalledWith(0);
    expect(printer.getModelMetadata()).toMatchObject({ model: 'QR380A', printheadPixels: 640 });

    const task = printer.protocol.newPrintTask('B1' as never, { density: 8, labelType: 1 });
    const rows = Array.from({ length: 80 }, () => new Uint8Array(80).fill(0xff));
    const page = task.printPage(rows, 1);
    await vi.waitFor(() => expect(sent()).toContain('PRINT 1,1'));
    reply([0x4f, 0x4b]);
    await page;
    expect(sent()).toMatch(/^SIZE 80 mm,10 mm/);
    // 6.4 KB of bitmap goes in two writes, not sixty.
    expect(written.length).toBeLessThanOrEqual(3);
    await printer.disconnect();
    expect(device.releaseInterface).toHaveBeenCalled();
    expect(device.close).toHaveBeenCalled();
  });

  it('reconnects to the one USB printer the site already uses without asking', async () => {
    const { device } = fakePrinter();
    const usb = installUsb([device]);
    await new UsbPrinter().connect();
    expect(usb.requestDevice).not.toHaveBeenCalled();
  });

  it('finds an unknown printer language from its device ID, and prefers the type picked under Advanced when the printer speaks it', async () => {
    const unknown = fakePrinter({ vendorId: 1, productId: 2, productName: 'LabelMaker' }).device;
    installUsb([unknown]);
    const auto = new UsbPrinter();
    await auto.connect();
    expect(auto.getModelMetadata()).toMatchObject({ model: 'LabelMaker', densityMax: 15 });

    installUsb([fakePrinter({ vendorId: 1, productId: 2, productName: 'LabelMaker' }).device]);
    const picked = new UsbPrinter();
    picked.unrecognisedAs('escpos-80');
    await picked.connect();
    expect(picked.getModelMetadata()).toMatchObject({ printheadPixels: 576, densityMax: 1 });
  });

  it('asks for the type when the printer does not say its language', async () => {
    const { device } = fakePrinter({ vendorId: 1, productId: 2, productName: 'Quiet', deviceId: '' });
    installUsb([device]);
    await expect(new UsbPrinter().connect()).rejects.toThrow(/Pick its type under Advanced/);
    expect(device.close).toHaveBeenCalled();
  });

  it('counts WebUSB as its own connection type', () => {
    expect(supportIssue('usb', { ua: '', touchPoints: 0, brave: false })).toMatchObject({ topic: 'browsers' });
    installUsb([]);
    expect(supportIssue('usb')).toBeNull();
  });
});
