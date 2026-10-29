import { CatPrinterClient, catModelFor, crc8, encodeRows, FLOW_PAUSE, FLOW_RESUME, packet, printJob } from './cat';
import { THERMAL_SIZES, type ThermalTransport } from './thermal';
import { resolveProfile } from './profiles';
import { sizesForPrinter } from './roll';
import { PrinterService } from './service';

const bytes = (signed: number[]) => signed.map((v) => v & 0xff);

/** A stand-in Bluetooth link that records writes and can push notifications. */
function fakeTransport(opts: { maxChunk?: number } = {}) {
  const writes: Uint8Array[] = [];
  let notify: (d: Uint8Array) => void = () => {};
  let dropped: () => void = () => {};
  const t: ThermalTransport = {
    name: 'MX06-ABCD',
    write: async (chunk) => {
      if (opts.maxChunk && chunk.length > opts.maxChunk) throw new Error('GATT operation failed');
      writes.push(chunk.slice());
    },
    onNotify: (fn) => (notify = fn),
    onDisconnect: (fn) => (dropped = fn),
    disconnect: async () => dropped(),
  };
  return { t, writes, push: (d: number[]) => notify(Uint8Array.from(d)), drop: () => dropped() };
}

describe('cat printers', () => {
  it('frames packets exactly like the reference implementations', () => {
    // Captured from rbaron/catprinter.
    expect(packet(0xa3, [0])).toEqual(bytes([81, 120, -93, 0, 1, 0, 0, 0, -1]));
    expect(packet(0xa4, [50])).toEqual(bytes([81, 120, -92, 0, 1, 0, 50, -98, -1]));
    expect(packet(0xa1, [48, 0])).toEqual(bytes([81, 120, -95, 0, 2, 0, 48, 0, -7, -1]));
    expect(packet(0xa6, [0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c]).slice(-2)).toEqual(bytes([-95, -1]));
    expect(crc8([0x10])).toBe(0x70);
  });

  it('recognises known models by name and leaves NIIMBOT names alone', () => {
    expect(catModelFor('MX06-1A2B')?.prefix).toBe('MX06');
    expect(catModelFor('GB03xyz')?.newKind).toBe(true);
    expect(catModelFor('SC03h')?.prefix).toBe('SC03h');
    for (const name of ['B21-C2BE513050609', 'D110-E331024479', 'D11-H', 'M2-H', 'B1-123', undefined]) expect(catModelFor(name)).toBeNull();
  });

  it('packs rows leftmost dot first, centred on the 384-dot head', () => {
    // A 320-dot page (40 mm), black at its first and last dot.
    const width = 320;
    const data = new Uint8ClampedArray(width * 4).fill(255);
    data[0] = 0;
    data[(width - 1) * 4] = 0;
    const [row] = encodeRows(data, width, 1);
    expect(row.length).toBe(48);
    // Centred: 32 dots of margin, so dot 32 is byte 4, bit 0; dot 351 is byte 43, bit 7.
    expect(row[4]).toBe(0b00000001);
    expect(row[43]).toBe(0b10000000);
    expect(row.reduce((n, b) => n + (b ? 1 : 0), 0)).toBe(2);
  });

  it('builds a job: setup, each copy with a gap, then feed', () => {
    const rows = [new Uint8Array(48).fill(0xff), new Uint8Array(48)];
    const job = Array.from(printJob(rows, { density: 3, copies: 2, model: catModelFor('GB02') }));
    const count = (cmd: number) => job.filter((_, i) => job[i] === 0x51 && job[i + 1] === 0x78 && job[i + 2] === cmd).length;
    expect(job.slice(0, 9)).toEqual(packet(0xa3, [0]));
    expect(count(0xa2)).toBe(2 * 2 + 24);
    expect(count(0xa1)).toBe(1);
    expect(count(0xaf)).toBe(1);
    expect(job.slice(-9)).toEqual(packet(0xa3, [0]));
    // GB03 adds the newer start byte; MX06 feeds with blank rows.
    expect(Array.from(printJob(rows, { density: 3, copies: 1, model: catModelFor('GB03') }))).toContain(0x12);
    const mx = Array.from(printJob(rows, { density: 3, copies: 1, model: catModelFor('MX06') }));
    expect(mx.filter((_, i) => mx[i] === 0x51 && mx[i + 1] === 0x78 && mx[i + 2] === 0xa1)).toHaveLength(0);
  });

  it('describes itself as a continuous-paper printer with a 48 mm head', () => {
    const client = new CatPrinterClient(fakeTransport().t, catModelFor('MX06'));
    const profile = resolveProfile(client.getModelMetadata(), client.getPrintTaskType());
    expect(profile).toMatchObject({ name: 'MX06', kind: 'thermal', printheadPixels: 384, printDirection: 'top', dpi: 203 });
    expect(sizesForPrinter(profile)).toEqual(THERMAL_SIZES);
    expect(client.getRfidInfo()).toEqual({});
  });

  it('sends in chunks, shrinking them when the link refuses', async () => {
    const link = fakeTransport({ maxChunk: 45 });
    const client = new CatPrinterClient(link.t, null, { chunkMs: 0, pauseMs: 1 });
    const data = Uint8Array.from({ length: 200 }, (_, i) => i);
    await client.send(data);
    expect(link.writes.every((w) => w.length <= 45)).toBe(true);
    expect(Array.from(link.writes.flatMap((w) => Array.from(w)))).toEqual(Array.from(data));
  });

  it('waits while the printer asks for a pause', async () => {
    const link = fakeTransport();
    const client = new CatPrinterClient(link.t, null, { chunkMs: 0, pauseMs: 5 });
    link.push(FLOW_PAUSE);
    let done = false;
    const sending = client.send(new Uint8Array(10)).then(() => (done = true));
    await new Promise((r) => setTimeout(r, 30));
    expect(done).toBe(false);
    expect(link.writes).toHaveLength(0);
    link.push(FLOW_RESUME);
    await sending;
    expect(link.writes).toHaveLength(1);
  });

  it('prints through the printer service with its own encoding', async () => {
    const link = fakeTransport();
    const client = new CatPrinterClient(link.t, catModelFor('MX06'), { chunkMs: 0, pauseMs: 1 });
    const encode = vi.fn();
    const service = new PrinterService(async () => client, encode);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await service.connect('bluetooth');
    expect(service.getStatus()).toMatchObject({ state: 'ready', detectedModel: 'MX06', label: undefined, deviceName: 'MX06-ABCD' });
    const ctx = { getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(0) }) };
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const page = Object.assign(document.createElement('canvas'), { width: 384, height: 8 });
    await service.print(page, { density: 3, copies: 1 });
    spy.mockRestore();
    expect(encode).not.toHaveBeenCalled();
    const sent = link.writes.flatMap((w) => Array.from(w));
    // Eight fully black rows went out.
    const rowStart = sent.findIndex((_, i) => sent[i] === 0x51 && sent[i + 1] === 0x78 && sent[i + 2] === 0xa2);
    expect(sent.slice(rowStart + 6, rowStart + 6 + 48).every((b) => b === 0xff)).toBe(true);
    expect(service.getStatus().state).toBe('ready');
  });

  it('reports a dropped connection', async () => {
    const link = fakeTransport();
    const service = new PrinterService(async () => new CatPrinterClient(link.t, null), vi.fn());
    await service.connect('bluetooth');
    link.drop();
    expect(service.getStatus().state).toBe('disconnected');
  });
});
