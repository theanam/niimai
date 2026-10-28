import type { ClientLike, ConnectionKind, PrintTaskLike } from './client';
import { findManualProfile, printheadCrop, resolveProfile, type PrinterProfile } from './profiles';

export type PrinterState = 'disconnected' | 'connecting' | 'ready' | 'printing';

export interface PrinterStatus {
  state: PrinterState;
  deviceName?: string;
  battery?: number;
  /** Null when the printer is unknown and no manual profile is chosen. */
  profile: PrinterProfile | null;
  detectedModel?: string;
  /**
   * The loaded roll. Size comes from the printer's paper info where it reports
   * one; the barcode identifies the roll when it does not (the B21 C2B, for one).
   */
  label?: { widthMm?: number; heightMm?: number; remaining?: number; capacity?: number; barcode?: string };
  lidClosed?: boolean;
  paperInserted?: boolean;
  progress?: { page: number; total: number };
}

export interface PrintOptions {
  density: number;
  copies: number;
  labelType?: number;
}

type Encoder = (canvas: HTMLCanvasElement, direction: PrinterProfile['printDirection']) => unknown | Promise<unknown>;
export type ClientFactory = (kind: ConnectionKind) => Promise<ClientLike>;

const DISCONNECTED: PrinterStatus = { state: 'disconnected', profile: null };

const PRINT_TIMEOUT_MS = 20_000;
const PAGE_TIMEOUT_MS = 10_000;
const PRINT_END_POLL_MS = 300;

/** Crops the page to what the printhead covers. Returns the canvas itself when it already fits. */
export function fitToPrinthead(canvas: HTMLCanvasElement, profile: PrinterProfile): HTMLCanvasElement {
  const crop = printheadCrop(canvas.width, canvas.height, profile);
  if (!crop.cropped) return canvas;
  const out = document.createElement('canvas');
  out.width = crop.width;
  out.height = crop.height;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return out;
}

/** Black pixels on the page, for the print log. A zero here means the page itself was blank. */
function inkPixels(canvas: HTMLCanvasElement): number | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] < 128) n++;
  return n;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout waiting for the printer to finish')), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/** Translates the library's error codes and messages into short, readable ones. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/user cancelled|no device selected|chooser/i.test(msg)) return 'Connection cancelled';
  if (/timeout waiting for the printer to finish/i.test(msg)) return 'The printer did not confirm the print';
  if (/timeout/i.test(msg)) return 'Printer stopped responding';
  if (/lid|cover/i.test(msg)) return 'Close the printer lid';
  if (/paper|label/i.test(msg) && /no|out|missing/i.test(msg)) return 'Load a label roll';
  if (/unknown Bluetooth service|No usable channel/i.test(msg)) return msg;
  if (/disconnected|gatt/i.test(msg)) return 'Printer disconnected';
  return msg || 'Something went wrong';
}

/**
 * Owns the printer connection. The UI subscribes to status updates and calls
 * connect/print; the raw protocol stays inside niimbluelib.
 */
export class PrinterService {
  private client: ClientLike | null = null;
  private status: PrinterStatus = DISCONNECTED;
  private listeners = new Set<(s: PrinterStatus) => void>();
  private manualProfileId: string | null = null;
  private detach: (() => void) | null = null;

  constructor(
    private createClient: ClientFactory,
    private encode: Encoder,
  ) {}

  getStatus(): PrinterStatus {
    return this.status;
  }

  subscribe(fn: (s: PrinterStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<PrinterStatus>): void {
    this.replace({ ...this.status, ...patch });
  }

  /** Swaps the whole status, so fields from an earlier connection never linger. */
  private replace(status: PrinterStatus): void {
    this.status = status;
    this.listeners.forEach((fn) => fn(this.status));
  }

  setManualProfile(id: string | null): void {
    this.manualProfileId = id;
    if (this.client) this.set({ profile: this.currentProfile() });
  }

  private currentProfile(): PrinterProfile | null {
    const c = this.client;
    return resolveProfile(c?.getModelMetadata(), c?.getPrintTaskType(), findManualProfile(this.manualProfileId), c?.getPrinterInfo().protocolVersion);
  }

  private readRfid(): PrinterStatus['label'] {
    const info = this.client?.getRfidInfo();
    if (!info) return undefined;
    const paper = info.paperInfo?.valid ? info.paperInfo : undefined;
    const tag = info.labelRfidInfo?.tagPresent ? info.labelRfidInfo : undefined;
    if (!paper && !tag) return undefined;
    return {
      widthMm: paper?.paperWidth,
      heightMm: paper?.paperHeight,
      remaining: tag && tag.allPaper !== undefined && tag.allPaper >= 0 ? Math.max(0, tag.allPaper - (tag.usedPaper ?? 0)) : undefined,
      capacity: tag && tag.allPaper !== undefined && tag.allPaper > 0 ? tag.allPaper : undefined,
      barcode: tag?.barCode || undefined,
    };
  }

  async connect(kind: ConnectionKind): Promise<void> {
    if (this.client) await this.disconnect();
    this.replace({ ...DISCONNECTED, state: 'connecting' });
    let client: ClientLike;
    try {
      client = await this.createClient(kind);
      const info = await client.connect();
      this.client = client;
      this.set({ deviceName: info.deviceName });
    } catch (err) {
      this.client = null;
      this.replace(DISCONNECTED);
      throw new Error(friendlyError(err));
    }

    const onDisconnect = () => this.handleDisconnect();
    const onHeartbeat = (e: { data: { batteryPercents?: number; lidClosed?: boolean; paperInserted?: boolean } }) =>
      this.set({ battery: e.data.batteryPercents ?? this.status.battery, lidClosed: e.data.lidClosed, paperInserted: e.data.paperInserted });
    const onRfid = () => this.set({ label: this.readRfid() });
    const onProgress = (e: { page: number; pagesTotal: number }) => this.set({ progress: { page: e.page, total: e.pagesTotal } });
    client.on('disconnect', onDisconnect);
    client.on('heartbeat', onHeartbeat);
    client.on('rfidinfofetched', onRfid);
    client.on('printprogress', onProgress);
    this.detach = () => {
      client.off('disconnect', onDisconnect);
      client.off('heartbeat', onHeartbeat);
      client.off('rfidinfofetched', onRfid);
      client.off('printprogress', onProgress);
    };

    const meta = client.getModelMetadata();
    this.set({
      state: 'ready',
      battery: client.getPrinterInfo().batteryPercents,
      detectedModel: meta?.model,
      profile: this.currentProfile(),
      label: this.readRfid(),
    });
    client.startHeartbeat();
  }

  private handleDisconnect(): void {
    this.detach?.();
    this.detach = null;
    this.client = null;
    this.replace(DISCONNECTED);
  }

  async disconnect(): Promise<void> {
    const c = this.client;
    if (!c) return;
    c.stopHeartbeat();
    try {
      await c.disconnect();
    } finally {
      this.handleDisconnect();
    }
  }

  /**
   * B21_V1 finishes by polling "print end", but niimbluelib's poll cancels its
   * own timer on the first reply, so it never resolves unless the printer is
   * already done. That task polls here instead.
   */
  private async waitForFinished(client: ClientLike, task: PrintTaskLike, name: string, copies: number): Promise<void> {
    if (name !== 'B21_V1') return task.waitForFinished();
    this.set({ progress: { page: 0, total: copies } });
    while (!(await client.protocol.printEnd())) await sleep(PRINT_END_POLL_MS);
    this.set({ progress: { page: copies, total: copies } });
  }

  async print(canvas: HTMLCanvasElement, opts: PrintOptions): Promise<void> {
    const client = this.client;
    const profile = this.status.profile;
    if (!client) throw new Error('Connect a printer first');
    if (!profile) throw new Error('Choose your printer type');
    if (this.status.state === 'printing') throw new Error('Already printing');

    const copies = Math.max(1, Math.floor(opts.copies));
    const density = Math.min(profile.densityMax, Math.max(profile.densityMin, Math.round(opts.density)));
    const task = client.protocol.newPrintTask(profile.printTask, {
      totalPages: copies,
      density,
      labelType: opts.labelType ?? 1,
      pageColor: 0,
      statusPollIntervalMs: 100,
      statusTimeoutMs: 8000,
    });

    // Heartbeat queries interleaved with page data spoil prints on some models.
    client.stopHeartbeat();
    this.set({ state: 'printing', progress: { page: 0, total: copies } });
    try {
      const page = fitToPrinthead(canvas, profile);
      const image = await this.encode(page, profile.printDirection);
      console.info('[niimai] print', {
        profile: profile.id,
        task: profile.printTask,
        direction: profile.printDirection,
        printhead: profile.printheadPixels,
        page: `${canvas.width}x${canvas.height}`,
        sent: `${page.width}x${page.height}`,
        density,
        copies,
        ink: inkPixels(page),
      });
      await task.printInit();
      await task.printPage(image, copies);
      await withTimeout(this.waitForFinished(client, task, profile.printTask, copies), PRINT_TIMEOUT_MS + copies * PAGE_TIMEOUT_MS);
    } catch (err) {
      throw new Error(friendlyError(err));
    } finally {
      try {
        await task.printEnd();
      } catch {
        // The page already failed; the original error is the useful one.
      }
      if (this.client) {
        client.startHeartbeat();
        this.set({ state: 'ready', progress: undefined });
        void client.fetchRfidInfo().then(() => this.set({ label: this.readRfid() }), () => {});
      }
    }
  }
}
