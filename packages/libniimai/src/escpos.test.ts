import { encodeRows, EscPosPrinterClient, escposJob, escposModelFor } from './escpos';
import { resolveProfile } from './profiles';
import { PrinterService } from './service';
import type { ThermalTransport } from './thermal';

function fakeTransport() {
  const writes: Uint8Array[] = [];
  const t: ThermalTransport = {
    name: 'MP583',
    write: async (chunk) => void writes.push(chunk.slice()),
    onNotify: () => {},
    onDisconnect: () => {},
    disconnect: async () => {},
  };
  return { t, writes };
}

describe('ESC/POS printers', () => {
  it('recognises known models and leaves other names alone', () => {
    expect(escposModelFor('MP583')).toMatchObject({ prefix: 'MP583', confidence: 'tested' });
    expect(escposModelFor('MP58A')?.prefix).toBe('MP58');
    expect(escposModelFor('PT-210_ABCD')?.prefix).toBe('PT-210');
    for (const name of ['D110-E331024479', 'B21-C2B', 'MX06-1A2B', 'M2-H', undefined]) expect(escposModelFor(name)).toBeNull();
  });

  it('packs rows leftmost dot in the highest bit, centred', () => {
    const width = 320;
    const data = new Uint8ClampedArray(width * 4).fill(255);
    data[0] = 0;
    const [row] = encodeRows(data, width, 1);
    // 32 dots of margin: dot 32 is byte 4, highest bit.
    expect(row[4]).toBe(0b10000000);
  });

  it('builds a job of raster bands with a gap between copies', () => {
    const rows = Array.from({ length: 30 }, () => new Uint8Array(48).fill(0xff));
    const job = Array.from(escposJob(rows, 2));
    expect(job.slice(0, 2)).toEqual([0x1b, 0x40]);
    // GS v 0, 48 bytes wide, a 24-row band.
    expect(job.slice(2, 10)).toEqual([0x1d, 0x76, 0x30, 0x00, 48, 0, 24, 0]);
    const bands = job.filter((_, i) => job[i] === 0x1d && job[i + 1] === 0x76 && job[i + 2] === 0x30).length;
    expect(bands).toBe(4);
    expect(job.filter((_, i) => job[i] === 0x1b && job[i + 1] === 0x4a).length).toBe(1);
    expect(job.slice(-3)).toEqual([0x1b, 0x64, 4]);
  });

  it('describes itself as a thermal printer with one heat setting', () => {
    const client = new EscPosPrinterClient(fakeTransport().t, escposModelFor('MP583'));
    expect(resolveProfile(client.getModelMetadata(), client.getPrintTaskType())).toMatchObject({ name: 'MP583', kind: 'thermal', densityMin: 1, densityMax: 1 });
  });

  it('prints through the printer service with its own encoding', async () => {
    const link = fakeTransport();
    const client = new EscPosPrinterClient(link.t, escposModelFor('MP583'), { chunkMs: 0, pauseMs: 1 });
    const encode = vi.fn();
    const service = new PrinterService(async () => client, encode);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await service.connect('bluetooth');
    const ctx = { getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(0) }) };
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    await service.print(Object.assign(document.createElement('canvas'), { width: 384, height: 8 }), { density: 1, copies: 1 });
    spy.mockRestore();
    expect(encode).not.toHaveBeenCalled();
    const sent = link.writes.flatMap((w) => Array.from(w));
    expect(sent.slice(0, 10)).toEqual([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, 48, 0, 8, 0]);
    expect(sent.slice(10, 10 + 48).every((b) => b === 0xff)).toBe(true);
    expect(link.writes.every((w) => w.length <= 100)).toBe(true);
  });
});
