/**
 * "Cat printers": the small Bluetooth thermal printers sold as GB01, MX06 and
 * the like, printing on 57 mm continuous paper with a 384-dot head. niimai's
 * focus is NIIMBOT; this is an extra, kept apart so NIIMBOT printing never
 * goes through it.
 *
 * Protocol, from rbaron/catprinter and NaitLee/Cat-Printer: packets are
 * 51 78 <cmd> 00 <len> 00 <payload> <crc8(payload)> FF over service AE30,
 * written to AE01. The printer sends flow control on AE02.
 */
import type { PrinterModelMeta, PrintTaskName } from '@mmote/niimbluelib';
import type { LabelSize } from '../doc/model';
import type { ClientLike, PrintTaskLike } from './client';

export const CAT_SERVICE = '0000ae30-0000-1000-8000-00805f9b34fb';
export const CAT_TX = '0000ae01-0000-1000-8000-00805f9b34fb';
export const CAT_RX = '0000ae02-0000-1000-8000-00805f9b34fb';

/** Dots across the head: 48 mm at 203 dpi. */
export const CAT_HEAD_DOTS = 384;
const ROW_BYTES = CAT_HEAD_DOTS / 8;

export type Confidence = 'tested' | 'high' | 'medium';

export interface CatModel {
  /** Bluetooth name prefix. */
  prefix: string;
  confidence: Confidence;
  /** Takes the newer "start printing" command. */
  newKind?: boolean;
  /** Mishandles the feed command, so the paper is fed with blank rows. */
  feedWithRows?: boolean;
  note?: string;
}

/**
 * Models known to speak this protocol. "high": supported by both reference
 * projects and widely used. "medium": listed by Cat-Printer, fewer reports.
 * "tested": printed with niimai on real hardware.
 */
export const CAT_MODELS: CatModel[] = [
  { prefix: 'GB01', confidence: 'high' },
  { prefix: 'GB02', confidence: 'high' },
  { prefix: 'GB03', confidence: 'high', newKind: true },
  { prefix: 'MX05', confidence: 'high', feedWithRows: true },
  { prefix: 'MX06', confidence: 'high', feedWithRows: true },
  { prefix: 'MX10', confidence: 'high', feedWithRows: true },
  { prefix: 'MX08', confidence: 'medium', feedWithRows: true },
  { prefix: 'MX09', confidence: 'medium', feedWithRows: true },
  { prefix: 'MX11', confidence: 'medium' },
  { prefix: 'GT01', confidence: 'medium' },
  { prefix: 'YT01', confidence: 'medium' },
  { prefix: 'PD01', confidence: 'medium' },
  { prefix: 'MXTP', confidence: 'medium' },
  { prefix: 'SC03h', confidence: 'medium' },
];

/** Look-alikes that use other protocols. */
export const CAT_UNSUPPORTED: { name: string; note: string }[] = [
  { name: 'MXW01', note: 'Newer protocol' },
  { name: 'PeriPage', note: 'Different protocol' },
  { name: 'Phomemo M02 / T02', note: 'Different protocol' },
];

/** The known model a Bluetooth name belongs to, longest prefix first. */
export function catModelFor(name: string | undefined): CatModel | null {
  if (!name) return null;
  return [...CAT_MODELS].sort((a, b) => b.prefix.length - a.prefix.length).find((m) => name.startsWith(m.prefix)) ?? null;
}

/** Sizes that suit continuous 57 mm paper: the full 48 mm print width at common lengths. */
export const CAT_SIZES: LabelSize[] = [15, 20, 30, 48, 80].map((heightMm) => ({
  widthMm: 48,
  heightMm,
}));
export const CAT_DEFAULT_SIZE: LabelSize = { widthMm: 48, heightMm: 30 };

// CRC-8, polynomial 0x07, as the printers expect.
const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let b = 0; b < 8; b++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  return c;
});
export const crc8 = (data: ArrayLike<number>): number => {
  let c = 0;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff];
  return c;
};

export function packet(cmd: number, payload: ArrayLike<number>): number[] {
  if (payload.length > 0xff) throw new Error('Payload too long');
  return [0x51, 0x78, cmd, 0x00, payload.length, 0x00, ...Array.from(payload), crc8(payload), 0xff];
}

const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];

const CMD = {
  feed: 0xa1,
  row: 0xa2,
  state: 0xa3,
  quality: 0xa4,
  lattice: 0xa6,
  update: 0xa9,
  energy: 0xaf,
  speed: 0xbd,
  applyEnergy: 0xbe,
} as const;

const LATTICE_START = [0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c];
const LATTICE_END = [0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17];

/** Flow control the printer sends on AE02 when its buffer fills and drains. */
export const FLOW_PAUSE = [0x51, 0x78, 0xae, 0x01, 0x01, 0x00, 0x10, 0x70, 0xff];
export const FLOW_RESUME = [0x51, 0x78, 0xae, 0x01, 0x01, 0x00, 0x00, 0x00, 0xff];

/** Heat energy for each darkness step; Cat-Printer prints images at 0x4000. */
const ENERGY = [0x2000, 0x3000, 0x4000, 0x6000, 0x9000];
/** Rows fed after the last copy, so the print clears the tear bar. */
const FEED_AFTER = 128;
/** Blank rows between copies. */
const GAP_BETWEEN = 24;

/**
 * Packs a 1-bit page (RGBA, dark = black) into 384-dot rows, leftmost dot in
 * the lowest bit, centred across the head.
 */
export function encodeRows(data: ArrayLike<number>, width: number, height: number): Uint8Array[] {
  const offset = Math.max(0, Math.floor((CAT_HEAD_DOTS - width) / 2));
  const rows: Uint8Array[] = [];
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(ROW_BYTES);
    for (let x = 0; x < width && x + offset < CAT_HEAD_DOTS; x++) {
      if (data[(y * width + x) * 4] < 128) {
        const dot = x + offset;
        row[dot >> 3] |= 1 << (dot & 7);
      }
    }
    rows.push(row);
  }
  return rows;
}

/** Everything sent for one job: setup, the rows for each copy, then feed and finish. */
export function printJob(rows: Uint8Array[], { density, copies, model }: { density: number; copies: number; model: CatModel | null }): Uint8Array {
  const out: number[] = [];
  const push = (cmd: number, payload: ArrayLike<number>) => out.push(...packet(cmd, payload));
  push(CMD.state, [0]);
  if (model?.newKind) out.push(0x12);
  push(CMD.state, [0]);
  push(CMD.quality, [50]);
  push(CMD.speed, [32]);
  push(CMD.energy, u16(ENERGY[Math.min(ENERGY.length, Math.max(1, Math.round(density))) - 1]));
  push(CMD.applyEnergy, [1]);
  push(CMD.update, [0]);
  push(CMD.lattice, LATTICE_START);
  const blank = new Uint8Array(ROW_BYTES);
  for (let c = 0; c < copies; c++) {
    if (c > 0) for (let i = 0; i < GAP_BETWEEN; i++) push(CMD.row, blank);
    for (const row of rows) push(CMD.row, row);
  }
  push(CMD.lattice, LATTICE_END);
  push(CMD.speed, [8]);
  if (model?.feedWithRows) for (let i = 0; i < FEED_AFTER; i++) push(CMD.row, blank);
  else push(CMD.feed, u16(FEED_AFTER));
  push(CMD.state, [0]);
  return Uint8Array.from(out);
}

/** The Bluetooth link, kept narrow so tests can stand in for it. */
export interface CatTransport {
  name?: string;
  write(chunk: Uint8Array): Promise<void>;
  onNotify(fn: (data: Uint8Array) => void): void;
  onDisconnect(fn: () => void): void;
  disconnect(): Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const same = (a: ArrayLike<number>, b: number[]) => a.length === b.length && b.every((v, i) => a[i] === v);

/**
 * A cat printer behind the same interface as a NIIMBOT client, so the printer
 * service drives both. It reports itself through model metadata with
 * kind "cat"; it has no roll tags, battery or heartbeat to offer.
 */
export class CatPrinterClient implements ClientLike {
  private listeners = new Map<string, Set<(e: unknown) => void>>();
  private paused = false;
  private connected = false;
  /** Bytes per write. Starts large and halves if the link refuses it. */
  private chunk = 180;

  constructor(
    private transport: CatTransport,
    readonly model: CatModel | null,
    private pace = { chunkMs: 20, pauseMs: 100 },
  ) {
    transport.onNotify((data) => {
      if (same(data, FLOW_PAUSE)) this.paused = true;
      else if (same(data, FLOW_RESUME)) this.paused = false;
    });
    transport.onDisconnect(() => {
      this.connected = false;
      this.emit('disconnect', {});
    });
  }

  async connect() {
    this.connected = true;
    return { deviceName: this.transport.name };
  }

  async disconnect() {
    this.connected = false;
    await this.transport.disconnect();
  }

  isConnected() {
    return this.connected;
  }

  on(event: string, fn: (e: unknown) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off(event: string, fn: (e: unknown) => void) {
    this.listeners.get(event)?.delete(fn);
  }

  private emit(event: string, e: unknown) {
    this.listeners.get(event)?.forEach((fn) => fn(e));
  }

  getPrinterInfo() {
    return {};
  }

  getModelMetadata(): PrinterModelMeta {
    return {
      model: this.model?.prefix ?? (this.transport.name || 'Thermal printer'),
      kind: 'cat',
      dpi: 203,
      printheadPixels: CAT_HEAD_DOTS,
      printDirection: 'top',
      densityMin: 1,
      densityMax: ENERGY.length,
      densityDefault: 3,
    } as unknown as PrinterModelMeta;
  }

  getPrintTaskType(): PrintTaskName {
    // The service needs a task name; the cat client prints the same way whatever it is.
    return 'B1' as PrintTaskName;
  }

  getRfidInfo() {
    return {};
  }

  async fetchRfidInfo() {}
  startHeartbeat() {}
  stopHeartbeat() {}

  /** Pages arrive as 1-bit canvases; the service hands them here instead of to niimbluelib's encoder. */
  encodePage(canvas: HTMLCanvasElement): Uint8Array[] {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable');
    return encodeRows(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  }

  /** Sends bytes in chunks, waiting while the printer asks for a pause. */
  async send(bytes: Uint8Array): Promise<void> {
    for (let i = 0; i < bytes.length;) {
      while (this.paused) await sleep(this.pace.pauseMs);
      const part = bytes.subarray(i, i + this.chunk);
      try {
        await this.transport.write(part);
      } catch (err) {
        if (this.chunk <= 20) throw err;
        this.chunk = Math.max(20, this.chunk >> 1);
        continue;
      }
      i += part.length;
      await sleep(this.pace.chunkMs);
    }
  }

  protocol = {
    printEnd: async () => true,
    newPrintTask: (_name: PrintTaskName, options: Record<string, unknown>): PrintTaskLike => {
      const density = Number(options.density ?? 3);
      return {
        printInit: async () => {},
        printPage: async (image, quantity = 1) => {
          const rows = image as Uint8Array[];
          await this.send(
            printJob(rows, {
              density,
              copies: Math.max(1, quantity),
              model: this.model,
            }),
          );
          this.emit('printprogress', {
            page: quantity,
            pagesTotal: quantity,
            pagePrintProgress: 100,
            pageFeedProgress: 100,
          });
        },
        waitForFinished: async () => {},
        printEnd: async () => true,
      };
    },
  };
}

/** A Web Bluetooth link to a connected cat printer. */
export async function webCatTransport(device: BluetoothDevice, server: BluetoothRemoteGATTServer): Promise<CatTransport> {
  const service = await server.getPrimaryService(CAT_SERVICE);
  const tx = await service.getCharacteristic(CAT_TX);
  const rx = await service.getCharacteristic(CAT_RX);
  const notify: ((d: Uint8Array) => void)[] = [];
  rx.addEventListener('characteristicvaluechanged', (e) => {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (v) notify.forEach((fn) => fn(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength))));
  });
  await rx.startNotifications();
  return {
    name: device.name,
    write: async (chunk) => {
      const buf = chunk.slice().buffer;
      if (tx.properties.writeWithoutResponse) await tx.writeValueWithoutResponse(buf);
      else await tx.writeValueWithResponse(buf);
    },
    onNotify: (fn) => notify.push(fn),
    onDisconnect: (fn) => device.addEventListener('gattserverdisconnected', fn),
    disconnect: async () => server.disconnect(),
  };
}
