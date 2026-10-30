/**
 * Shared ground for the extra Bluetooth thermal printers: cat printers and
 * ESC/POS mini printers. Both print 58 mm continuous paper with a 384-dot
 * head. niimai's focus is NIIMBOT; these clients are kept apart so NIIMBOT
 * printing never goes through them.
 */
import type { PrinterModelMeta, PrintTaskName } from '@mmote/niimbluelib';
import type { LabelSize } from '../doc/model';
import type { ClientLike, PrintTaskLike } from './client';

/** Dots across the head: 48 mm at 203 dpi. */
export const THERMAL_HEAD_DOTS = 384;
/** The print width in whole millimetres, the widest a design on continuous paper can be. */
export const THERMAL_HEAD_MM = 48;

export type Confidence = 'tested' | 'high' | 'medium';

export interface ThermalModel {
  /** Bluetooth name prefix. */
  prefix: string;
  confidence: Confidence;
  note?: string;
}

/** The known model a Bluetooth name belongs to, longest prefix first. */
export function modelFor<M extends ThermalModel>(models: M[], name: string | undefined): M | null {
  if (!name) return null;
  return [...models].sort((a, b) => b.prefix.length - a.prefix.length).find((m) => name.startsWith(m.prefix)) ?? null;
}

/** Sizes that suit 58 mm continuous paper: the full 48 mm print width at common lengths. */
export const THERMAL_SIZES: LabelSize[] = [15, 20, 30, 48, 80].map((heightMm) => ({ widthMm: 48, heightMm }));
export const THERMAL_DEFAULT_SIZE: LabelSize = { widthMm: 48, heightMm: 30 };

/**
 * Packs a 1-bit page (RGBA, dark = black) into 384-dot rows, centred across
 * the head. Cat printers want the leftmost dot in the lowest bit, ESC/POS in
 * the highest.
 */
export function packRows(data: ArrayLike<number>, width: number, height: number, order: 'lsb' | 'msb'): Uint8Array[] {
  const offset = Math.max(0, Math.floor((THERMAL_HEAD_DOTS - width) / 2));
  const rows: Uint8Array[] = [];
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(THERMAL_HEAD_DOTS / 8);
    for (let x = 0; x < width && x + offset < THERMAL_HEAD_DOTS; x++) {
      if (data[(y * width + x) * 4] < 128) {
        const dot = x + offset;
        row[dot >> 3] |= order === 'lsb' ? 1 << (dot & 7) : 0x80 >> (dot & 7);
      }
    }
    rows.push(row);
  }
  return rows;
}

/** The Bluetooth link, kept narrow so tests can stand in for it. */
export interface ThermalTransport {
  name?: string;
  write(chunk: Uint8Array): Promise<void>;
  onNotify(fn: (data: Uint8Array) => void): void;
  onDisconnect(fn: () => void): void;
  disconnect(): Promise<void>;
}

export interface Pace {
  /** Pause after each write. */
  chunkMs: number;
  /** How often to look again while the printer asks to wait. */
  pauseMs: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A thermal printer behind the same interface as a NIIMBOT client, so the
 * printer service drives both. It reports itself through model metadata with
 * kind "thermal"; it has no roll tags, battery or heartbeat to offer.
 * Subclasses supply the row encoding and the bytes for a job.
 */
export abstract class ThermalPrinterClient implements ClientLike {
  private listeners = new Map<string, Set<(e: unknown) => void>>();
  private connected = false;
  /** Set while the printer asks to wait (cat printers' flow control). */
  protected paused = false;
  /** Bytes per write. Starts large and halves if the link refuses it. */
  private chunk: number;

  protected abstract readonly densityLevels: number;
  /** The model name shown for this printer. */
  protected abstract readonly modelName: string;
  protected abstract encodeRows(data: ArrayLike<number>, width: number, height: number): Uint8Array[];
  protected abstract job(rows: Uint8Array[], density: number, copies: number): Uint8Array;

  constructor(
    protected transport: ThermalTransport,
    protected pace: Pace,
    firstChunk: number,
  ) {
    this.chunk = firstChunk;
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
      model: this.modelName,
      kind: 'thermal',
      dpi: 203,
      printheadPixels: THERMAL_HEAD_DOTS,
      printDirection: 'top',
      densityMin: 1,
      densityMax: this.densityLevels,
      densityDefault: Math.ceil(this.densityLevels / 2),
    } as unknown as PrinterModelMeta;
  }

  getPrintTaskType(): PrintTaskName {
    // The service needs a task name; these clients print the same way whatever it is.
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
    return this.encodeRows(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  }

  /** Sends bytes in chunks, waiting while the printer asks for a pause. */
  async send(bytes: Uint8Array): Promise<void> {
    for (let i = 0; i < bytes.length; ) {
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
      const density = Number(options.density ?? 1);
      // A batch sends several pages to one task; progress counts across them.
      let printed = 0;
      return {
        printInit: async () => {},
        printPage: async (image, quantity = 1) => {
          await this.send(this.job(image as Uint8Array[], density, Math.max(1, quantity)));
          printed += Math.max(1, quantity);
          const total = Math.max(printed, Number(options.totalPages ?? printed));
          this.emit('printprogress', { page: printed, pagesTotal: total, pagePrintProgress: 100, pageFeedProgress: 100 });
        },
        waitForFinished: async () => {},
        printEnd: async () => true,
      };
    },
  };
}

/** A Web Bluetooth link through one service: a write characteristic and, if present, a notify one. */
export async function webTransport(
  device: BluetoothDevice,
  server: BluetoothRemoteGATTServer,
  ids: { service: string; write: string; notify?: string },
): Promise<ThermalTransport> {
  const service = await server.getPrimaryService(ids.service);
  const tx = await service.getCharacteristic(ids.write);
  const notify: ((d: Uint8Array) => void)[] = [];
  if (ids.notify) {
    const rx = await service.getCharacteristic(ids.notify);
    rx.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
      if (v) notify.forEach((fn) => fn(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength))));
    });
    await rx.startNotifications();
  }
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
