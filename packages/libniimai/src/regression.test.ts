/**
 * Guards the printers niimai already supported while new kinds are added:
 * what each existing client reports, and the bytes it sends, must not move.
 */
import { CAT_MODELS, CatPrinterClient, catModelFor, printJob } from './cat';
import { ESCPOS_MODELS, EscPosPrinterClient, escposJob, escposModelFor } from './escpos';
import { MARKLIFE_MODELS } from './marklife';
import { TSPL_MODELS, TsplPrinterClient, tsplModelFor } from './tspl';
import { webTransport } from './thermal';
import { findManualProfile, resolveProfile } from './profiles';
import { PrinterService } from './service';
import type { ThermalTransport } from './thermal';

const link = (name: string): ThermalTransport => ({ name, write: async () => {}, onNotify: () => {}, onDisconnect: () => {}, disconnect: async () => {} });

describe('existing printers stay as they were', () => {
  it('ESC/POS printers report the same continuous-paper model', () => {
    const client = new EscPosPrinterClient(link('MP583'), escposModelFor('MP583'));
    expect(client.getModelMetadata()).toEqual({
      model: 'MP583',
      kind: 'thermal',
      dpi: 203,
      printheadPixels: 384,
      printDirection: 'top',
      densityMin: 1,
      densityMax: 1,
      densityDefault: 1,
    });
  });

  it('cat printers report the same continuous-paper model', () => {
    const client = new CatPrinterClient(link('MX06-1A2B'), catModelFor('MX06-1A2B'));
    expect(client.getModelMetadata()).toEqual({
      model: 'MX06',
      kind: 'thermal',
      dpi: 203,
      printheadPixels: 384,
      printDirection: 'top',
      densityMin: 1,
      densityMax: 5,
      densityDefault: 3,
    });
  });

  it('both still show as continuous paper, with no roll to set', () => {
    for (const client of [new EscPosPrinterClient(link('MP583'), escposModelFor('MP583')), new CatPrinterClient(link('GB01'), catModelFor('GB01'))]) {
      expect('rollKey' in client).toBe(false);
      const profile = resolveProfile(client.getModelMetadata(), client.getPrintTaskType());
      expect(profile?.kind).toBe('thermal');
      expect(profile?.sizes).toBeUndefined();
    }
  });

  it('their print jobs ignore the paper type, as before', async () => {
    const rows = Array.from({ length: 10 }, () => new Uint8Array(48).fill(0xaa));
    for (const make of [
      (t: ThermalTransport) => new EscPosPrinterClient(t, escposModelFor('MP583'), { chunkMs: 0, pauseMs: 1 }),
      (t: ThermalTransport) => new CatPrinterClient(t, catModelFor('GB01'), { chunkMs: 0, pauseMs: 1 }),
    ]) {
      const sent: number[][] = [];
      for (const labelType of [1, 3]) {
        const bytes: number[] = [];
        const client = make({ ...link('x'), write: async (c) => void bytes.push(...c) });
        await client.protocol.newPrintTask('B1' as never, { density: 1, labelType }).printPage(rows, 2);
        sent.push(bytes);
      }
      expect(sent[0]).toEqual(sent[1]);
    }
    // And they are still the plain jobs each protocol builds.
    expect(escposJob(rows, 1).slice(0, 2)).toEqual(Uint8Array.of(0x1b, 0x40));
    expect(printJob(rows, { density: 1, copies: 1, model: catModelFor('GB01') })[0]).toBe(0x51);
  });

  it('NIIMBOT printers still go through niimbluelib’s encoder with the paper type', async () => {
    const tasks: Record<string, unknown>[] = [];
    const encode = vi.fn(() => ({ encoded: true }));
    const client = {
      connect: async () => ({ deviceName: 'D110-E331024479' }),
      disconnect: async () => {},
      isConnected: () => true,
      on: () => {},
      off: () => {},
      getPrinterInfo: () => ({}),
      getModelMetadata: () => ({ model: 'D110', dpi: 203, printheadPixels: 96, printDirection: 'left', densityMin: 1, densityMax: 3, densityDefault: 2 }),
      getPrintTaskType: () => 'D110',
      getRfidInfo: () => ({}),
      fetchRfidInfo: async () => {},
      startHeartbeat: () => {},
      stopHeartbeat: () => {},
      protocol: {
        printEnd: async () => true,
        newPrintTask: (_n: string, o: Record<string, unknown>) => {
          tasks.push(o);
          return { printInit: async () => {}, printPage: async () => {}, waitForFinished: async () => {}, printEnd: async () => true };
        },
      },
    };
    const service = new PrinterService(async () => client as never, encode);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await service.connect('bluetooth');
    expect(service.getStatus().profile).toMatchObject({ printheadPixels: 96, printDirection: 'left' });
    expect(service.getStatus().profile?.kind).toBeUndefined();
    expect(service.getStatus().label).toBeUndefined();
    await service.print(Object.assign(document.createElement('canvas'), { width: 240, height: 96 }), { density: 2, copies: 1, labelType: 1 });
    expect(encode).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 'left');
    expect(tasks[0]).toMatchObject({ labelType: 1, density: 2 });
  });

  it('NIIMBOT printers bring no size list of their own', () => {
    for (const id of ['d11', 'd110', 'b1', 'b21']) expect(findManualProfile(id)!.sizes).toBeUndefined();
  });

  it('no printer name belongs to two families', () => {
    const families = [CAT_MODELS, ESCPOS_MODELS, TSPL_MODELS, MARKLIFE_MODELS].map((list) => list.map((m) => m.prefix));
    families.forEach((mine, i) =>
      families.forEach((theirs, j) => {
        if (i === j) return;
        for (const a of mine) for (const b of theirs) expect(a.startsWith(b) || b.startsWith(a)).toBe(false);
      }),
    );
  });

  it('TSPL printers still report the same label-printer model', () => {
    const client = new TsplPrinterClient(link('QR380A-02B55B'), tsplModelFor('QR380A-02B55B'));
    expect(client.getModelMetadata()).toMatchObject({ model: 'QR380A', printheadPixels: 640, printDirection: 'top', densityMax: 15 });
    expect(client.rollKey()).toBe('printer:QR380A-02B55B');
  });

  it('a Bluetooth link without flow control is the same link as before', async () => {
    const char = { properties: { writeWithoutResponse: true }, addEventListener: vi.fn(), startNotifications: vi.fn(async () => {}), writeValueWithoutResponse: vi.fn(async () => {}) };
    const getCharacteristic = vi.fn(async () => char);
    const server = { getPrimaryService: async () => ({ getCharacteristic }), disconnect: () => {} };
    const t = await webTransport({ name: 'QR380A', addEventListener: () => {} } as never, server as never, { service: 's', write: 'w', notify: 'n' });
    expect(getCharacteristic.mock.calls.map((c) => c[0])).toEqual(['w', 'n']);
    expect(char.startNotifications).toHaveBeenCalledTimes(1);
    expect('onControl' in t).toBe(false);
  });
});
