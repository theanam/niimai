import { inflateSync } from 'node:zlib';
import { resolveProfile } from './profiles';
import { deflate1k, encodeTapeRows, l11Job, MARKLIFE_MODELS, MARKLIFE_TAPE_SIZES, marklifeModelFor, MarklifePrinterClient, yxqJob } from './marklife';
import type { ThermalTransport } from './thermal';

const hex = (bytes: ArrayLike<number>) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');

/** A page as getImageData gives it, black where `ink` says. */
function page(width: number, height: number, ink: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (ink(x, y)) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return data;
}

/** A link that records writes, with hooks to send replies and credits. */
function link(name = 'P12_ZA15B_BLE', withControl = true) {
  const writes: Uint8Array[] = [];
  let notify: (d: Uint8Array) => void = () => {};
  let control: (d: Uint8Array) => void = () => {};
  const transport: ThermalTransport = {
    name,
    write: async (c) => void writes.push(c.slice()),
    onNotify: (fn) => (notify = fn),
    ...(withControl ? { onControl: (fn: (d: Uint8Array) => void) => (control = fn) } : {}),
    onDisconnect: () => {},
    disconnect: async () => {},
  };
  return { transport, writes, reply: (b: number[]) => notify(Uint8Array.from(b)), grant: (n: number) => control(Uint8Array.of(0x01, n)) };
}

const FAST = { chunkMs: 0, pauseMs: 1 };

describe('Marklife printers', () => {
  it('knows the P12, P15, P11 and P50 by their Bluetooth names', () => {
    expect(marklifeModelFor('P12_ZA15B_BLE')).toMatchObject({ prefix: 'P12', protocol: 'l11', headDots: 96, packetBytes: 90 });
    expect(marklifeModelFor('P15_1A2B')).toMatchObject({ prefix: 'P15', protocol: 'l11', thickness: true, packetBytes: 95 });
    expect(marklifeModelFor('P15R_1A2B')?.prefix).toBe('P15');
    expect(marklifeModelFor('P11_1A2B')?.prefix).toBe('P11');
    expect(marklifeModelFor('P50S_1A2B')).toMatchObject({ prefix: 'P50', protocol: 'yxq', headDots: 384 });
    expect(marklifeModelFor('D110-E331024479')).toBeNull();
  });

  describe('deflate with a 1 KB window', () => {
    const cases: [string, Uint8Array][] = [
      ['empty', new Uint8Array()],
      ['blank raster', new Uint8Array(48 * 240)],
      ['striped raster', Uint8Array.from({ length: 48 * 400 }, (_, i) => (Math.floor(i / 48) % 7 < 3 ? 0xff : i % 5))],
      ['noise', Uint8Array.from({ length: 5000 }, (_, i) => (i * 2654435761) >>> 24)],
      ['repeats past the window', Uint8Array.from({ length: 9000 }, (_, i) => (i % 1500) & 0xff)],
    ];
    it.each(cases)('round-trips a %s through a decoder held to a 1 KB window', (_, data) => {
      const z = deflate1k(data);
      expect(hex(z.subarray(0, 2))).toBe('28 15');
      expect(new Uint8Array(inflateSync(z, { windowBits: 10 }))).toEqual(data);
    });

    it('packs a mostly blank raster small', () => {
      expect(deflate1k(new Uint8Array(48 * 240)).length).toBeLessThan(200);
    });
  });

  describe('L11 tape printers', () => {
    it('turns the label a quarter: its top meets the first dot, its right edge prints first', () => {
      const rows = encodeTapeRows(page(320, 96, (x, y) => (x === 319 && y === 0) || (x === 0 && y === 95)), 320, 96);
      expect(rows).toHaveLength(320);
      expect(rows[0]).toHaveLength(12);
      expect(rows[0][0]).toBe(0x80);
      expect(rows[319][11]).toBe(0x01);
      expect(rows.slice(1, 319).every((r) => r.every((b) => b === 0))).toBe(true);
    });

    it('centres narrower tape on the head', () => {
      const rows = encodeTapeRows(page(10, 72, (_, y) => y === 0), 10, 72);
      // 72 dots on a 96-dot head start 12 dots in.
      expect(rows[0][1]).toBe(0x08);
    });

    it('builds the job Marklife’s app sends: darkness, wake, start, raster, to the gap, stop', () => {
      const rows = [Uint8Array.of(0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01), new Uint8Array(12)];
      const job = l11Job(rows, { density: 2, copies: 1, labelType: 1 });
      expect(hex(job)).toBe(
        [
          '1f 70 02 02',
          Array(15).fill('00').join(' '),
          '10 ff f1 02',
          '1d 76 30 00 0c 00 02 00',
          'ff 00 00 00 00 00 00 00 00 00 00 01',
          '00 00 00 00 00 00 00 00 00 00 00 00',
          '1d 0c',
          '10 ff f1 45',
        ].join(' '),
      );
    });

    it('feeds continuous tape a fixed length, sets darkness by thickness on the P15, and repeats copies', () => {
      const rows = [new Uint8Array(12)];
      expect(hex(l11Job(rows, { density: 9, copies: 1, labelType: 3 }))).toMatch(/1b 4a 64 10 ff f1 45$/);
      const p15 = l11Job(rows, { density: 0, copies: 2, labelType: 1, thickness: true });
      expect(hex(p15.subarray(0, 5))).toBe('10 ff 10 00 01');
      expect(hex(p15).split('10 ff f1 02')).toHaveLength(3);
    });

    it('shows as a label printer on 12 mm tape that runs sideways, with the roll remembered', () => {
      const client = new MarklifePrinterClient(link().transport, marklifeModelFor('P12_ZA15B_BLE')!);
      expect(client.getModelMetadata()).toEqual({
        model: 'P12',
        labelSizes: MARKLIFE_TAPE_SIZES,
        dpi: 203,
        printheadPixels: 96,
        printDirection: 'left',
        densityMin: 1,
        densityMax: 3,
        densityDefault: 2,
      });
      expect(client.rollKey()).toBe('printer:P12_ZA15B_BLE');
      expect('feedPaper' in client).toBe(false);
      const profile = resolveProfile(client.getModelMetadata(), client.getPrintTaskType());
      expect(profile).toMatchObject({ printDirection: 'left', printheadPixels: 96, sizes: MARKLIFE_TAPE_SIZES });
      expect(profile?.kind).toBeUndefined();
    });
  });

  describe('YXQ sticker printers', () => {
    it('builds the P50 job: paper mode, darkness, start, line up, deflated raster, next label, stop, park', () => {
      const rows = Array.from({ length: 30 }, (_, i) => new Uint8Array(48).fill(i % 2 ? 0xf0 : 0));
      const job = yxqJob(rows, { density: 8, copies: 1, labelType: 1 });
      expect(hex(job.subarray(0, 15))).toBe('1f 80 01 20 1f 70 01 08 1f c0 01 00 1f 11 51');
      expect(hex(job.subarray(15, 21))).toBe('1f 10 00 30 00 1e');
      const n = (job[21] << 24) | (job[22] << 16) | (job[23] << 8) | job[24];
      const z = job.subarray(25, 25 + n);
      const flat = new Uint8Array(inflateSync(z, { windowBits: 10 }));
      expect(flat).toEqual(Uint8Array.from(rows.flatMap((r) => [...r])));
      expect(hex(job.subarray(25 + n))).toBe('1f 12 20 00 1f c0 01 01 1f 11 50');
    });

    it('marks black-mark paper, skips lining up on continuous paper, and lines up only the first copy', () => {
      const rows = [new Uint8Array(48)];
      expect(hex(yxqJob(rows, { density: 1, copies: 1, labelType: 2 }).subarray(0, 4))).toBe('1f 80 01 30');
      const roll = hex(yxqJob(rows, { density: 1, copies: 1, labelType: 3 }));
      expect(roll.startsWith('1f 80 01 10')).toBe(true);
      expect(roll).not.toContain('1f 11 5');
      const two = hex(yxqJob(rows, { density: 1, copies: 2, labelType: 1 }));
      expect(two.split('1f c0 01 00')).toHaveLength(3);
      expect(two.split('1f 11 51')).toHaveLength(2);
    });

    it('shows as a 2-inch label printer, top first', () => {
      const client = new MarklifePrinterClient(link('P50S_1A2B').transport, marklifeModelFor('P50S_1A2B')!);
      expect(client.getModelMetadata()).toMatchObject({ model: 'P50', printheadPixels: 384, printDirection: 'top', densityMax: 15 });
    });
  });

  describe('sending', () => {
    const p12 = MARKLIFE_MODELS[0];

    it('writes in the firmware’s packet size and waits for the printer to confirm', async () => {
      const { transport, writes, reply } = link();
      const client = new MarklifePrinterClient(transport, p12, FAST);
      const done = client.protocol.newPrintTask('B1' as never, { density: 2, labelType: 1 }).printPage(Array.from({ length: 100 }, () => new Uint8Array(12)), 1);
      await vi.waitFor(() => expect(writes.length).toBeGreaterThan(10));
      expect(writes.every((w) => w.length <= 90)).toBe(true);
      reply([0xaa]);
      await done;
    });

    it('spends the credits the printer hands out and waits for more', async () => {
      const { transport, writes, grant, reply } = link();
      const client = new MarklifePrinterClient(transport, p12, FAST);
      grant(2);
      const done = client.send(new Uint8Array(90 * 5));
      await vi.waitFor(() => expect(writes).toHaveLength(2));
      await new Promise((r) => setTimeout(r, 50));
      expect(writes).toHaveLength(2);
      grant(3);
      await done;
      expect(writes).toHaveLength(5);
      reply([0xaa]);
    });

    it('fails the print on a fault the printer reports', async () => {
      const { transport, reply } = link();
      const client = new MarklifePrinterClient(transport, p12, FAST);
      const done = client.protocol.newPrintTask('B1' as never, { density: 2, labelType: 1 }).printPage([new Uint8Array(12)], 1);
      setTimeout(() => reply([0xff, 0x01]), 10);
      await expect(done).rejects.toThrow('Out of paper');
    });

    it('carries on when the printer stays quiet', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { transport } = link('P12', false);
      const client = new MarklifePrinterClient(transport, p12, FAST, 20);
      await client.protocol.newPrintTask('B1' as never, { density: 2, labelType: 1 }).printPage([new Uint8Array(12)], 1);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
