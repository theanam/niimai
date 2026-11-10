/**
 * Marklife label printers (made by FeiOou/Deli, also sold under other names).
 * They look like NIIMBOT printers but share nothing with them inside. Two
 * protocols, both over service FF00: write FF02, replies on FF01, and flow
 * control on FF03.
 *
 * - L11, on the P12/P15 tape printers: 15 zero bytes to wake, 10 FF F1 02 to
 *   start, a plain GS v 0 raster, 1D 0C to the next gap (or ESC J on
 *   continuous tape), 10 FF F1 45 to stop. The 12 mm tape runs sideways
 *   through a 96-dot head.
 * - YXQ, on the P50: 1F-prefixed commands around a 1F 10 raster deflated
 *   with a 1 KB window, the most the printer can inflate.
 *
 * From the protocol notes of tomLadder/thermoprint (taken from Marklife's
 * Android app), thermal-label/marklife, and Marklife's own web kit.
 */
import type { LabelSize } from './profiles';
import { modelFor, packRows, shownName, sleep, ThermalPrinterClient, type Pace, type ThermalModel, type ThermalTransport } from './thermal';

export const MARKLIFE_SERVICE = '0000ff00-0000-1000-8000-00805f9b34fb';
export const MARKLIFE_NOTIFY = '0000ff01-0000-1000-8000-00805f9b34fb';
export const MARKLIFE_WRITE = '0000ff02-0000-1000-8000-00805f9b34fb';
export const MARKLIFE_CONTROL = '0000ff03-0000-1000-8000-00805f9b34fb';

export interface MarklifeModel extends ThermalModel {
  protocol: 'l11' | 'yxq';
  /** Bytes per Bluetooth write: the firmware drops larger ones, whatever the link allows. */
  packetBytes: number;
  /** Sets darkness with the "thickness" command (10 FF 10 00), as the P15 does. */
  thickness?: boolean;
}

/**
 * Models known to speak these protocols. "high": printed on real hardware
 * by the reference projects. "medium": the same protocol by Marklife's app,
 * with fewer reports. Names that NIIMBOT also uses (A1, P1S, T2) are left out,
 * so a NIIMBOT is never taken for one.
 */
export const MARKLIFE_MODELS: MarklifeModel[] = [
  { prefix: 'P12', confidence: 'high', protocol: 'l11', headDots: 96, packetBytes: 90, usbIds: [[0x09c7, 0x0011]] },
  { prefix: 'P15', confidence: 'high', protocol: 'l11', headDots: 96, packetBytes: 95, thickness: true, usbIds: [[0x5958, 0x0015]] },
  { prefix: 'P11', confidence: 'medium', protocol: 'l11', headDots: 96, packetBytes: 90 },
  { prefix: 'P50', confidence: 'medium', note: 'Also P50S', protocol: 'yxq', headDots: 384, packetBytes: 90 },
];

export const marklifeModelFor = (name: string | undefined): MarklifeModel | null => modelFor(MARKLIFE_MODELS, name);

/** Tape sizes for the P12/P15 family, length × tape width. */
export const MARKLIFE_TAPE_SIZES: LabelSize[] = [
  [22, 12],
  [30, 12],
  [40, 12],
  [22, 14],
  [30, 14],
  [40, 14],
  [26, 15],
  [30, 15],
  [40, 15],
  [50, 15],
].map(([widthMm, heightMm]) => ({ widthMm, heightMm }));

/** Common sticker sizes for the 2-inch P50. */
export const MARKLIFE_STICKER_SIZES: LabelSize[] = [
  [30, 15],
  [30, 20],
  [40, 20],
  [40, 30],
  [40, 40],
  [50, 20],
  [50, 25],
  [50, 30],
  [50, 40],
  [50, 50],
].map(([widthMm, heightMm]) => ({ widthMm, heightMm }));

/** NIIMBOT label types, as the print dialog passes them. */
const LABEL_TYPE = { blackmark: 2, continuous: 3 } as const;

// ---- L11 ----

const L11_WAKE = new Array<number>(15).fill(0);
const L11_START = [0x10, 0xff, 0xf1, 0x02];
const L11_STOP = [0x10, 0xff, 0xf1, 0x45];
const L11_TO_GAP = [0x1d, 0x0c];
/** Feed after a label on continuous tape, in dots. */
const L11_FEED = 100;
/** L11 darkness: light, normal, dark. */
const L11_LEVELS = 3;

/**
 * Rows for an L11 printer. The page arrives as the label reads, its height
 * across the head. It is turned a quarter, as Marklife's app turns it: the
 * label's top meets the first dot and its right edge prints first. Centred
 * on the head, leftmost dot in the highest bit, 1 for dark.
 */
export function encodeTapeRows(data: ArrayLike<number>, width: number, height: number, head = 96): Uint8Array[] {
  const offset = Math.max(0, Math.floor((head - height) / 2));
  const rows: Uint8Array[] = [];
  for (let x = 0; x < width; x++) {
    const row = new Uint8Array(head / 8);
    for (let y = 0; y < height && y + offset < head; y++) {
      if (data[(y * width + (width - 1 - x)) * 4] < 128) {
        const dot = y + offset;
        row[dot >> 3] |= 0x80 >> (dot & 7);
      }
    }
    rows.push(row);
  }
  return rows;
}

/** GS v 0: the raster, uncompressed. */
function rasterL11(rows: Uint8Array[]): number[] {
  const bytes = rows[0]?.length ?? 0;
  const out = [0x1d, 0x76, 0x30, 0x00, bytes & 0xff, bytes >> 8, rows.length & 0xff, rows.length >> 8];
  for (const row of rows) for (const b of row) out.push(b);
  return out;
}

/** One L11 job: darkness, then for each copy wake, start, the raster, the feed to the next label, stop. */
export function l11Job(rows: Uint8Array[], { density, copies, labelType, thickness }: { density: number; copies: number; labelType: number; thickness?: boolean }): Uint8Array {
  const level = Math.min(L11_LEVELS, Math.max(1, Math.round(density)));
  const out = thickness ? [0x10, 0xff, 0x10, 0x00, level] : [0x1f, 0x70, 0x02, level];
  const raster = rasterL11(rows);
  const feed = labelType === LABEL_TYPE.continuous ? [0x1b, 0x4a, L11_FEED] : L11_TO_GAP;
  for (let c = 0; c < Math.max(1, copies); c++) out.push(...L11_WAKE, ...L11_START, ...raster, ...feed, ...L11_STOP);
  return Uint8Array.from(out);
}

// ---- YXQ ----

const YXQ_START = [0x1f, 0xc0, 0x01, 0x00];
const YXQ_STOP = [0x1f, 0xc0, 0x01, 0x01];
/** Line the paper up before the first label, and park it after the last. */
const YXQ_ALIGN = [0x1f, 0x11, 0x51];
const YXQ_PARK = [0x1f, 0x11, 0x50];
/** YXQ darkness steps, as Marklife's web kit sets them. */
const YXQ_LEVELS = 15;

/** The paper mode the printer finds labels by: gaps, black marks, or none. */
const yxqPaper = (labelType: number) => (labelType === LABEL_TYPE.continuous ? 0x10 : labelType === LABEL_TYPE.blackmark ? 0x30 : 0x20);

/** 1F 10: the raster deflated, with its size in bytes per row and rows, and the deflated length. */
function rasterYxq(rows: Uint8Array[]): number[] {
  const bytes = rows[0]?.length ?? 0;
  const flat = new Uint8Array(bytes * rows.length);
  rows.forEach((row, i) => flat.set(row, i * bytes));
  const z = deflate1k(flat);
  const n = z.length;
  const out = [0x1f, 0x10, bytes >> 8, bytes & 0xff, rows.length >> 8, rows.length & 0xff, (n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  for (const b of z) out.push(b);
  return out;
}

/**
 * One YXQ job: paper mode and darkness, then for each copy start, the
 * raster, find the next label, stop. Labels with gaps or marks are lined up
 * before the first copy and parked after the last.
 */
export function yxqJob(rows: Uint8Array[], { density, copies, labelType }: { density: number; copies: number; labelType: number }): Uint8Array {
  const mode = yxqPaper(labelType);
  const labels = labelType !== LABEL_TYPE.continuous;
  const out = [0x1f, 0x80, 0x01, mode, 0x1f, 0x70, 0x01, Math.min(YXQ_LEVELS, Math.max(1, Math.round(density)))];
  const raster = rasterYxq(rows);
  for (let c = 0; c < Math.max(1, copies); c++) {
    out.push(...YXQ_START);
    if (c === 0 && labels) out.push(...YXQ_ALIGN);
    out.push(...raster, 0x1f, 0x12, mode, 0x00, ...YXQ_STOP);
  }
  if (labels) out.push(...YXQ_PARK);
  return Uint8Array.from(out);
}

// ---- Deflate with a 1 KB window ----

const WINDOW = 1024;
const MIN_MATCH = 3;
const MAX_MATCH = 258;
const CHAIN = 64;

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8];

class Bits {
  out: number[] = [];
  private acc = 0;
  private n = 0;
  /** `count` bits of `value`, lowest first. */
  put(value: number, count: number) {
    this.acc |= value << this.n;
    this.n += count;
    while (this.n >= 8) {
      this.out.push(this.acc & 0xff);
      this.acc >>>= 8;
      this.n -= 8;
    }
  }
  /** A Huffman code, highest bit first. */
  code(code: number, len: number) {
    let r = 0;
    for (let i = 0; i < len; i++) r |= ((code >> i) & 1) << (len - 1 - i);
    this.put(r, len);
  }
  flush() {
    if (this.n > 0) this.out.push(this.acc & 0xff);
    this.acc = 0;
    this.n = 0;
  }
}

/** Fixed Huffman code for a literal or length symbol. */
function litCode(bits: Bits, sym: number) {
  if (sym < 144) bits.code(0x30 + sym, 8);
  else if (sym < 256) bits.code(0x190 + sym - 144, 9);
  else if (sym < 280) bits.code(sym - 256, 7);
  else bits.code(0xc0 + sym - 280, 8);
}

const indexIn = (table: number[], v: number) => {
  let i = table.length - 1;
  while (table[i] > v) i--;
  return i;
};

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * zlib with a 1 KB window, as the YXQ printers inflate it: one block of
 * fixed Huffman codes, with matches no further back than 1 KB. Rasters are
 * mostly blank, so this packs them well without dynamic tables.
 */
export function deflate1k(data: Uint8Array): Uint8Array {
  const bits = new Bits();
  // CMF 0x28: deflate, 1 KB window. FLG 0x15 makes the header a multiple of 31.
  bits.put(0x28, 8);
  bits.put(0x15, 8);
  bits.put(1, 1); // final block
  bits.put(1, 2); // fixed Huffman codes
  const head = new Int32Array(1 << 15).fill(-1);
  const prev = new Int32Array(data.length).fill(-1);
  const hash = (i: number) => ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & 0x7fff;
  const insert = (i: number) => {
    if (i + 2 >= data.length) return;
    const h = hash(i);
    prev[i] = head[h];
    head[h] = i;
  };
  for (let i = 0; i < data.length; ) {
    let bestLen = 0;
    let bestDist = 0;
    if (i + MIN_MATCH <= data.length) {
      const max = Math.min(MAX_MATCH, data.length - i);
      for (let j = head[hash(i)], tries = 0; j >= 0 && i - j <= WINDOW && tries < CHAIN; j = prev[j], tries++) {
        let len = 0;
        while (len < max && data[j + len] === data[i + len]) len++;
        if (len > bestLen) {
          bestLen = len;
          bestDist = i - j;
          if (len === max) break;
        }
      }
    }
    if (bestLen >= MIN_MATCH) {
      const li = indexIn(LENGTH_BASE, bestLen);
      litCode(bits, 257 + li);
      if (LENGTH_EXTRA[li]) bits.put(bestLen - LENGTH_BASE[li], LENGTH_EXTRA[li]);
      const di = indexIn(DIST_BASE, bestDist);
      bits.code(di, 5);
      if (DIST_EXTRA[di]) bits.put(bestDist - DIST_BASE[di], DIST_EXTRA[di]);
      for (let k = 0; k < bestLen; k++) insert(i + k);
      i += bestLen;
    } else {
      litCode(bits, data[i]);
      insert(i);
      i++;
    }
  }
  litCode(bits, 256);
  bits.flush();
  const sum = adler32(data);
  bits.out.push(sum >>> 24, (sum >> 16) & 0xff, (sum >> 8) & 0xff, sum & 0xff);
  return Uint8Array.from(bits.out);
}

// ---- Client ----

/** Replies that mean a label printed. */
const DONE = [0xaa, 0x4f, 0x4b];
/** Status replies, FF then a code, that stop a print. */
const FAULTS: Record<number, string> = { 0x01: 'Out of paper', 0x02: 'Printer cover is open', 0x03: 'Printer is too hot' };
/** How long to wait for a label to be confirmed before carrying on. */
const ACK_TIMEOUT_MS = 15_000;
/** With no credit for this long, send one packet anyway, as Marklife's app does. */
const STARVED_MS = 1_000;

/**
 * A Marklife printer: the shared thermal client with L11 or YXQ jobs. It
 * shows as a label printer that finds each label's edge itself; the roll
 * size is remembered per printer. Writes go in the packets the firmware
 * takes, and wait for the credits it hands out on FF03.
 */
export class MarklifePrinterClient extends ThermalPrinterClient {
  protected readonly densityLevels: number;
  protected readonly modelName: string;
  protected readonly headDots: number;
  protected readonly printDirection: 'top' | 'left';
  protected readonly kind = undefined;
  protected readonly labelSizes: LabelSize[];

  private readonly tape: boolean;
  private readonly packet: number;
  /** Credits the printer has granted; null until it sends any, and the writes are only paced. */
  private credits: number | null = null;
  private done = 0;
  private fault: string | null = null;
  private wake: (() => void) | null = null;

  constructor(
    transport: ThermalTransport,
    readonly model: MarklifeModel,
    pace: Pace = { chunkMs: 30, pauseMs: 100 },
    private ackTimeoutMs = ACK_TIMEOUT_MS,
  ) {
    super(transport, pace, model.packetBytes);
    this.tape = model.protocol === 'l11';
    this.modelName = shownName(model, transport, 'Marklife');
    this.headDots = model.headDots ?? (this.tape ? 96 : 384);
    this.printDirection = this.tape ? 'left' : 'top';
    this.densityLevels = this.tape ? L11_LEVELS : YXQ_LEVELS;
    this.labelSizes = this.tape ? MARKLIFE_TAPE_SIZES : MARKLIFE_STICKER_SIZES;
    this.packet = transport.chunkBytes ?? model.packetBytes;
    transport.onNotify((data) => {
      if (DONE.includes(data[0])) this.done++;
      else if (data[0] === 0xff && FAULTS[data[1]]) this.fault = FAULTS[data[1]];
      else return;
      this.wake?.();
    });
    transport.onControl?.((data) => {
      if (data[0] !== 0x01 || data.length < 2) return;
      this.credits = (this.credits ?? 0) + data[1];
      this.wake?.();
    });
  }

  protected encodeRows(data: ArrayLike<number>, width: number, height: number) {
    return this.tape ? encodeTapeRows(data, width, height, this.headDots) : packRows(data, width, height, 'msb', this.headDots);
  }

  /** These printers find the gaps but not the size; it is remembered per printer. */
  rollKey() {
    return `printer:${this.transport.name || this.modelName}`;
  }

  protected job(rows: Uint8Array[], density: number, copies: number, labelType: number) {
    this.done = 0;
    this.fault = null;
    return this.tape ? l11Job(rows, { density, copies, labelType, thickness: this.model.thickness }) : yxqJob(rows, { density, copies, labelType });
  }

  /** Resolves when `ready` holds or the time runs out. */
  private async until(ready: () => boolean, ms: number) {
    const deadline = Date.now() + ms;
    while (!ready() && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, deadline - Date.now());
        this.wake = () => (clearTimeout(t), resolve());
      });
    }
    this.wake = null;
  }

  /** Sends in the firmware's packet size, spending a credit on each once the printer hands them out. */
  async send(bytes: Uint8Array, onSent?: (share: number) => void): Promise<void> {
    for (let i = 0; i < bytes.length; ) {
      if (this.fault) throw new Error(this.fault);
      if (this.credits !== null) {
        await this.until(() => this.credits! > 0, STARVED_MS);
        if (this.credits <= 0) this.credits = 1;
      }
      const part = bytes.subarray(i, i + this.packet);
      await this.transport.write(part);
      if (this.credits !== null) this.credits--;
      i += part.length;
      onSent?.(i / bytes.length);
      if (this.pace.chunkMs) await sleep(this.pace.chunkMs);
    }
  }

  /** Waits for the printer to confirm the label. A fault fails the print; a quiet printer is left to carry on. */
  protected async afterPage() {
    await this.until(() => this.done > 0 || this.fault !== null, this.ackTimeoutMs);
    if (this.fault) throw new Error(this.fault);
    if (!this.done) console.warn('[niimai] Marklife printer did not confirm the label');
  }
}
