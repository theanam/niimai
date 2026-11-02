/**
 * TSPL label printers: 2- and 3-inch desktop label printers that take TSC's
 * label language over the 18F0 printer service. A job is a few text commands
 * (SIZE, GAP, DENSITY, CLS) around one BITMAP of the page, then PRINT. The
 * printer finds each label's edge itself. It answers "OK" on 2AF0 when it has
 * taken a job, and a status byte to ESC ! ?.
 */
import type { LabelSize } from './profiles';
import { modelFor, shownName, ThermalPrinterClient, type Pace, type ThermalModel, type ThermalTransport } from './thermal';

export const TSPL_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
export const TSPL_WRITE = '00002af1-0000-1000-8000-00805f9b34fb';
export const TSPL_NOTIFY = '00002af0-0000-1000-8000-00805f9b34fb';

/** Dots across the head: 80 mm at 203 dpi. */
export const TSPL_HEAD_DOTS = 640;
const DOTS_PER_MM = 8;

/**
 * Models known to take TSPL over 18F0. "tested": printed with niimai on real
 * hardware. "medium": reported by open-source printer projects, untested here.
 */
export const TSPL_MODELS: ThermalModel[] = [
  { prefix: 'QR380A', confidence: 'tested', note: 'Sold as CC390' },
  { prefix: 'GP-M322', confidence: 'medium', brand: 'Gprinter GP-M322', headDots: 576 },
];

export const tsplModelFor = (name: string | undefined): ThermalModel | null => modelFor(TSPL_MODELS, name);

/** Common 2- to 3-inch label sizes, width × height in mm, smallest first. */
export const TSPL_SIZES: LabelSize[] = [
  [40, 30],
  [50, 25],
  [50, 30],
  [50, 40],
  [57, 32],
  [60, 40],
  [50, 50],
  [70, 50],
  [75, 50],
  [80, 50],
  [60, 60],
  [80, 60],
  [80, 80],
  [75, 100],
].map(([widthMm, heightMm]) => ({ widthMm, heightMm }));

/** TSPL's darkness steps, 0 to 15; niimai offers 1 to 15. */
const DENSITY_LEVELS = 15;
/** The gap between labels, for printers that look for it. */
const GAP_MM = 2;

/** NIIMBOT label types, as the print dialog passes them. */
const LABEL_TYPE = { blackmark: 2, continuous: 3 } as const;

/** The status query, and the bits of its answer that stop a print. */
export const STATUS_QUERY = [0x1b, 0x21, 0x3f];
const STATUS_FAULTS: [number, string][] = [
  [0x01, 'Printer cover is open'],
  [0x02, 'Paper jam'],
  [0x04, 'Out of paper'],
  [0x08, 'Out of ribbon'],
];

/** Replies that mean a job was taken: "OK". */
const OK = [0x4f, 0x4b];
/** How long to wait for "OK" before asking the printer what is wrong. */
const ACK_TIMEOUT_MS = 20_000;
/** How long to wait for the answer to a status query. */
const STATUS_TIMEOUT_MS = 2_000;

/**
 * Rows for a TSPL BITMAP: as wide as the page, leftmost dot in the highest
 * bit, and 0 for a dark dot.
 */
export function encodeRows(data: ArrayLike<number>, width: number, height: number): Uint8Array[] {
  const bytes = Math.ceil(width / 8);
  const rows: Uint8Array[] = [];
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(bytes).fill(0xff);
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4] < 128) row[x >> 3] &= ~(0x80 >> (x & 7));
    rows.push(row);
  }
  return rows;
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const mm = (dots: number) => `${Math.round((dots / DOTS_PER_MM) * 10) / 10} mm`;

/** How the printer finds the start of each label. */
function paperCommand(labelType: number): string {
  if (labelType === LABEL_TYPE.continuous) return 'GAP 0 mm,0 mm';
  if (labelType === LABEL_TYPE.blackmark) return `BLINE ${GAP_MM} mm,0 mm`;
  return `GAP ${GAP_MM} mm,0 mm`;
}

/** One label: setup, the page as one bitmap at the top left, then print it `copies` times. */
export function tsplJob(rows: Uint8Array[], { density, copies, labelType }: { density: number; copies: number; labelType: number }): Uint8Array {
  const bytes = rows[0]?.length ?? 0;
  const height = rows.length;
  const head = [
    `SIZE ${mm(bytes * 8)},${mm(height)}`,
    paperCommand(labelType),
    'DIRECTION 0',
    `DENSITY ${Math.min(DENSITY_LEVELS, Math.max(0, Math.round(density)))}`,
    'CLS',
  ];
  const out = ascii(head.map((l) => `${l}\r\n`).join('') + `BITMAP 0,0,${bytes},${height},0,`);
  for (const row of rows) for (const b of row) out.push(b);
  out.push(...ascii(`\r\nPRINT ${Math.max(1, copies)},1\r\n`));
  return Uint8Array.from(out);
}

/**
 * A TSPL label printer: the shared thermal client with TSPL jobs. It shows
 * as a label printer (roll sizes, paper types). Writes are paced at the size
 * these printers' BLE modules take without dropping data.
 */
export class TsplPrinterClient extends ThermalPrinterClient {
  protected readonly densityLevels = DENSITY_LEVELS;
  protected readonly modelName: string;
  protected readonly headDots: number;
  protected readonly kind = undefined;
  protected readonly labelSizes = TSPL_SIZES;

  private oks = 0;
  private status: number | null = null;
  private wake: (() => void) | null = null;

  constructor(
    transport: ThermalTransport,
    readonly model: ThermalModel | null,
    pace: Pace = { chunkMs: 30, pauseMs: 100 },
    private ackTimeoutMs = ACK_TIMEOUT_MS,
  ) {
    super(transport, pace, 100);
    this.modelName = shownName(model, transport, 'Label printer');
    this.headDots = model?.headDots ?? TSPL_HEAD_DOTS;
    transport.onNotify((data) => {
      if (data.length >= 2 && data[0] === OK[0] && data[1] === OK[1]) this.oks++;
      else if (data.length === 1) this.status = data[0];
      else return;
      this.wake?.();
    });
  }

  protected encodeRows(data: ArrayLike<number>, width: number, height: number) {
    return encodeRows(data, width, height);
  }

  /** These printers cannot sense the roll; its size is remembered per printer. */
  rollKey() {
    return `printer:${this.transport.name || this.modelName}`;
  }

  protected job(rows: Uint8Array[], density: number, copies: number, labelType: number) {
    this.oks = 0;
    return tsplJob(rows, { density, copies, labelType });
  }

  /** Resolves when `done` holds or the time runs out. */
  private async until(done: () => boolean, ms: number) {
    const deadline = Date.now() + ms;
    while (!done() && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, deadline - Date.now());
        this.wake = () => (clearTimeout(t), resolve());
      });
    }
    this.wake = null;
  }

  /**
   * Waits for the printer's "OK", so the next label never lands on a busy
   * printer. Without one, asks for its status: a fault fails the print, and a
   * printer that is merely quiet is left to carry on.
   */
  protected async afterPage() {
    await this.until(() => this.oks > 0, this.ackTimeoutMs);
    if (this.oks > 0) return;
    this.status = null;
    await this.send(Uint8Array.from(STATUS_QUERY));
    await this.until(() => this.status !== null, STATUS_TIMEOUT_MS);
    const fault = STATUS_FAULTS.find(([bit]) => (this.status ?? 0) & bit);
    if (fault) throw new Error(fault[1]);
    console.warn('[niimai] Label printer did not confirm the job');
  }
}
