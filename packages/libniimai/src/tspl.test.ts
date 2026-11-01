import { resolveProfile } from './profiles';
import { PrinterService } from './service';
import type { ThermalTransport } from './thermal';
import { encodeRows, STATUS_QUERY, TSPL_SIZES, TsplPrinterClient, tsplJob, tsplModelFor } from './tspl';

const text = (bytes: ArrayLike<number>) => String.fromCharCode(...Array.from(bytes));

/** A link that answers each job with `reply`, and status queries with `status`. */
function fakeTransport({ reply = 'OK', status = 0 }: { reply?: string | null; status?: number } = {}) {
  const writes: Uint8Array[] = [];
  let notify: (d: Uint8Array) => void = () => {};
  let sent = '';
  const t: ThermalTransport = {
    name: 'QR380A-02B55B',
    write: async (chunk) => {
      writes.push(chunk.slice());
      sent += text(chunk);
      if (reply && sent.endsWith('PRINT 1,1\r\n')) setTimeout(() => notify(Uint8Array.from(reply, (c) => c.charCodeAt(0))));
      if (STATUS_QUERY.every((b, i) => chunk[i] === b) && chunk.length === 3) setTimeout(() => notify(Uint8Array.of(status)));
    },
    onNotify: (fn) => void (notify = fn),
    onDisconnect: () => {},
    disconnect: async () => {},
  };
  return { t, writes };
}

const ink = { getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(0) }) };

async function printWith(client: TsplPrinterClient, labelType?: number) {
  const service = new PrinterService(async () => client, vi.fn());
  vi.spyOn(console, 'info').mockImplementation(() => {});
  await service.connect('bluetooth');
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ink as never);
  try {
    // A 40 × 30 mm label.
    await service.print(Object.assign(document.createElement('canvas'), { width: 320, height: 240 }), { density: 8, copies: 1, labelType });
  } finally {
    spy.mockRestore();
  }
  return service;
}

describe('TSPL label printers', () => {
  it('recognises known models and leaves other names alone', () => {
    expect(tsplModelFor('QR380A-02B55B')).toMatchObject({ prefix: 'QR380A', confidence: 'tested' });
    for (const name of ['MP583', 'D110-E331024479', 'B21-C2B', 'MX06-1A2B', 'QR38', undefined]) expect(tsplModelFor(name)).toBeNull();
  });

  it('packs rows as wide as the page, 0 for a dark dot, leftmost dot in the highest bit', () => {
    const data = new Uint8ClampedArray(10 * 4).fill(255);
    data[0] = 0;
    data[9 * 4] = 0;
    const [row] = encodeRows(data, 10, 1);
    expect(Array.from(row)).toEqual([0b01111111, 0b10111111]);
  });

  it('writes the label size, gap, darkness and one bitmap, then prints the copies', () => {
    const rows = Array.from({ length: 800 }, () => new Uint8Array(76));
    const job = tsplJob(rows, { density: 8, copies: 3, labelType: 1 });
    const head = text(job.subarray(0, 120));
    expect(head.startsWith('SIZE 76 mm,100 mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 0\r\nDENSITY 8\r\nCLS\r\nBITMAP 0,0,76,800,0,')).toBe(true);
    expect(text(job.subarray(-13))).toBe('\r\nPRINT 3,1\r\n');
    const header = head.indexOf('BITMAP 0,0,76,800,0,') + 'BITMAP 0,0,76,800,0,'.length;
    expect(job.length).toBe(header + 76 * 800 + 13);
  });

  it('follows the paper type: no gap on continuous paper, a black mark when asked', () => {
    const rows = [new Uint8Array(8)];
    expect(text(tsplJob(rows, { density: 8, copies: 1, labelType: 3 }))).toContain('GAP 0 mm,0 mm\r\n');
    expect(text(tsplJob(rows, { density: 8, copies: 1, labelType: 2 }))).toContain('BLINE 2 mm,0 mm\r\n');
    expect(text(tsplJob(rows, { density: 8, copies: 1, labelType: 4 }))).toContain('GAP 2 mm,0 mm\r\n');
  });

  it('shows as an 80 mm label printer with roll sizes, not continuous paper', () => {
    const client = new TsplPrinterClient(fakeTransport().t, tsplModelFor('QR380A-02B55B'));
    const profile = resolveProfile(client.getModelMetadata(), client.getPrintTaskType());
    expect(profile).toMatchObject({ name: 'QR380A', printheadPixels: 640, printDirection: 'top', densityMin: 1, densityMax: 15, densityDefault: 8 });
    expect(profile?.kind).toBeUndefined();
  });

  it('offers common 2- to 3-inch label sizes, 3 × 4 inch included', () => {
    const client = new TsplPrinterClient(fakeTransport().t, tsplModelFor('QR380A-02B55B'));
    const profile = resolveProfile(client.getModelMetadata(), client.getPrintTaskType());
    expect(profile?.sizes).toBe(TSPL_SIZES);
    expect(TSPL_SIZES).toEqual(expect.arrayContaining([{ widthMm: 75, heightMm: 100 }, { widthMm: 50, heightMm: 30 }, { widthMm: 80, heightMm: 50 }]));
    expect(TSPL_SIZES.every((s) => s.widthMm <= 80)).toBe(true);
  });

  it('reports how much of each label has been sent while it prints', async () => {
    const link = fakeTransport();
    const client = new TsplPrinterClient(link.t, tsplModelFor('QR380A-02B55B'), { chunkMs: 0, pauseMs: 1 });
    const sent: number[] = [];
    client.on('printprogress', (e) => (e as { sending?: number }).sending !== undefined && sent.push((e as { sending: number }).sending));
    await printWith(client);
    expect(sent.length).toBeGreaterThan(10);
    expect(sent.at(-1)).toBe(100);
    expect(sent).toEqual([...sent].sort((a, b) => a - b));
  });

  it('reports a roll to remember per printer, since it cannot sense one', async () => {
    const service = new PrinterService(async () => new TsplPrinterClient(fakeTransport().t, tsplModelFor('QR380A-02B55B')), vi.fn());
    await service.connect('bluetooth');
    expect(service.getStatus().label).toEqual({ barcode: 'printer:QR380A-02B55B', manual: true });
  });

  it('prints through the printer service in small packets, with the paper type chosen', async () => {
    const link = fakeTransport();
    await printWith(new TsplPrinterClient(link.t, tsplModelFor('QR380A-02B55B'), { chunkMs: 0, pauseMs: 1 }), 3);
    const sent = text(link.writes.flatMap((w) => Array.from(w)));
    expect(sent.startsWith('SIZE 40 mm,30 mm\r\nGAP 0 mm,0 mm\r\n')).toBe(true);
    expect(sent).toContain('BITMAP 0,0,40,240,0,');
    expect(sent.endsWith('PRINT 1,1\r\n')).toBe(true);
    expect(link.writes.every((w) => w.length <= 100)).toBe(true);
  });

  it('fails the print with the printer’s fault when it does not confirm', async () => {
    const client = new TsplPrinterClient(fakeTransport({ reply: null, status: 0x04 }).t, tsplModelFor('QR380A-02B55B'), { chunkMs: 0, pauseMs: 1 }, 20);
    await expect(printWith(client)).rejects.toThrow('Load a label roll');
  });

  it('carries on when a healthy printer stays quiet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = new TsplPrinterClient(fakeTransport({ reply: null, status: 0 }).t, tsplModelFor('QR380A-02B55B'), { chunkMs: 0, pauseMs: 1 }, 20);
    await printWith(client);
    expect(warn).toHaveBeenCalled();
  });
});
