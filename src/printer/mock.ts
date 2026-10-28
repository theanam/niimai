import type { PrinterModelMeta } from '@mmote/niimbluelib';
import type { ClientLike, PrintTaskLike } from './client';

type Listener = (e: any) => void;

/** A printer that only exists in memory. Used by the demo mode and the tests. */
export class MockClient implements ClientLike {
  connected = false;
  printed: { image: unknown; quantity: number; heartbeat: boolean }[] = [];
  failNextPrint: string | null = null;
  private listeners = new Map<string, Set<Listener>>();

  /** Pass null to act as a model the library does not recognise. */
  constructor(private meta: PrinterModelMeta | null = DEMO_META) {}

  async connect() {
    this.connected = true;
    this.emit('connect', { info: { deviceName: 'Demo printer' } });
    return { deviceName: 'Demo printer' };
  }
  async disconnect() {
    this.connected = false;
    this.emit('disconnect', {});
  }
  isConnected() {
    return this.connected;
  }
  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return this;
  }
  off(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn);
    return this;
  }
  emit(event: string, e: unknown) {
    this.listeners.get(event)?.forEach((fn) => fn(e));
  }
  protocolVersion = 1;
  getPrinterInfo() {
    return { batteryPercents: 80, modelId: 512, printheadWidth: 96, protocolVersion: this.protocolVersion };
  }
  getModelMetadata() {
    return this.meta ?? undefined;
  }
  getPrintTaskType() {
    return this.meta ? ('D11_V1' as const) : undefined;
  }
  /** Set false to act like printers that report only the roll's barcode. */
  reportsPaperSize = true;

  getRfidInfo() {
    return {
      labelRfidInfo: { tagPresent: true, barCode: '6971501227941', allPaper: 210, usedPaper: 12 },
      paperInfo: this.reportsPaperSize ? { valid: true, paperWidth: 40, paperHeight: 12 } : undefined,
    };
  }
  async fetchRfidInfo() {
    return this.getRfidInfo();
  }
  startHeartbeat() {
    this.heartbeat = true;
    this.emit('heartbeat', { data: { batteryPercents: 80, lidClosed: true, paperInserted: true } });
  }
  heartbeat = false;
  stopHeartbeat() {
    this.heartbeat = false;
  }
  /** How many "print end" polls answer false before the printer reports done. */
  printEndPending = 0;
  protocol = {
    printEnd: async () => {
      if (this.printEndPending > 0) {
        this.printEndPending--;
        return false;
      }
      return true;
    },
    newPrintTask: (_name: string, options: Record<string, unknown>): PrintTaskLike => {
      const total = Number(options.totalPages ?? 1);
      return {
        printInit: async () => {
          if (this.failNextPrint) {
            const msg = this.failNextPrint;
            this.failNextPrint = null;
            throw new Error(msg);
          }
        },
        printPage: async (image, quantity = 1) => {
          this.printed.push({ image, quantity, heartbeat: this.heartbeat });
        },
        waitForFinished: async () => {
          for (let page = 1; page <= total; page++) {
            this.emit('printprogress', { page, pagesTotal: total, pagePrintProgress: 100, pageFeedProgress: 100 });
          }
        },
        printEnd: async () => true,
      };
    },
  };
}

export const DEMO_META = {
  model: 'D11',
  id: [512],
  dpi: 203,
  printDirection: 'left',
  printheadPixels: 96,
  paperTypes: [1],
  densityMin: 1,
  densityMax: 3,
  densityDefault: 2,
} as unknown as PrinterModelMeta;
