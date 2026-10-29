/**
 * "Cat printers": the small Bluetooth thermal printers sold as GB01, MX06 and
 * the like. See thermal.ts for what they share with other extras.
 *
 * Protocol, from rbaron/catprinter and NaitLee/Cat-Printer: packets are
 * 51 78 <cmd> 00 <len> 00 <payload> <crc8(payload)> FF over service AE30,
 * written to AE01. The printer sends flow control on AE02.
 */
import { modelFor, packRows, THERMAL_HEAD_DOTS, ThermalPrinterClient, type Confidence, type Pace, type ThermalModel, type ThermalTransport } from './thermal';

export const CAT_SERVICE = '0000ae30-0000-1000-8000-00805f9b34fb';
export const CAT_TX = '0000ae01-0000-1000-8000-00805f9b34fb';
export const CAT_RX = '0000ae02-0000-1000-8000-00805f9b34fb';

const ROW_BYTES = THERMAL_HEAD_DOTS / 8;

export type { Confidence };

export interface CatModel extends ThermalModel {
  /** Takes the newer "start printing" command. */
  newKind?: boolean;
  /** Mishandles the feed command, so the paper is fed with blank rows. */
  feedWithRows?: boolean;
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

/** Look-alikes that use other protocols. Listed in Help and docs/thermal-printers.md. */
export const CAT_UNSUPPORTED: { name: string; note: string }[] = [
  { name: 'MXW01', note: 'Newer protocol' },
  { name: 'PeriPage', note: 'Different protocol' },
  { name: 'Phomemo M02 / T02', note: 'Different protocol' },
];

export const catModelFor = (name: string | undefined): CatModel | null => modelFor(CAT_MODELS, name);

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

/** Rows for a cat printer: leftmost dot in the lowest bit. */
export const encodeRows = (data: ArrayLike<number>, width: number, height: number): Uint8Array[] => packRows(data, width, height, 'lsb');

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

/** A cat printer: the shared thermal client with cat packets and flow control. */
export class CatPrinterClient extends ThermalPrinterClient {
  protected readonly densityLevels = ENERGY.length;
  protected readonly modelName: string;

  constructor(
    transport: ThermalTransport,
    readonly model: CatModel | null,
    pace: Pace = { chunkMs: 20, pauseMs: 100 },
  ) {
    super(transport, pace, 180);
    this.modelName = model?.prefix ?? (transport.name || 'Cat printer');
    transport.onNotify((data) => {
      if (same(data, FLOW_PAUSE)) this.paused = true;
      else if (same(data, FLOW_RESUME)) this.paused = false;
    });
  }

  protected encodeRows(data: ArrayLike<number>, width: number, height: number) {
    return encodeRows(data, width, height);
  }

  protected job(rows: Uint8Array[], density: number, copies: number) {
    return printJob(rows, { density, copies, model: this.model });
  }
}

const same = (a: ArrayLike<number>, b: number[]) => a.length === b.length && b.every((v, i) => a[i] === v);
