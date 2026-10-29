import type { PrinterModelMeta, PrintTaskName } from '@mmote/niimbluelib';

/**
 * The slice of niimbluelib's client the app uses. Keeping it narrow lets the
 * mock printer and the tests stand in for real hardware.
 */
export interface PrintTaskLike {
  printInit(): Promise<void>;
  printPage(image: unknown, quantity?: number): Promise<void>;
  waitForFinished(): Promise<void>;
  printEnd(): Promise<boolean>;
}

export interface ClientLike {
  connect(): Promise<{ deviceName?: string }>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  on(event: string, fn: (e: any) => void): unknown;
  off(event: string, fn: (e: any) => void): unknown;
  getPrinterInfo(): { batteryPercents?: number; modelId?: number; printheadWidth?: number; protocolVersion?: number };
  getModelMetadata(): PrinterModelMeta | undefined;
  getPrintTaskType(): PrintTaskName | undefined;
  getRfidInfo(): {
    labelRfidInfo?: { tagPresent?: boolean; barCode?: string; allPaper?: number; usedPaper?: number; consumablesType?: number };
    paperInfo?: { valid?: boolean; paperWidth?: number; paperHeight?: number; paperType?: number };
  };
  fetchRfidInfo(): Promise<unknown>;
  startHeartbeat(): void;
  stopHeartbeat(): void;
  isHeartbeatStarted?(): boolean;
  protocol: {
    newPrintTask(name: PrintTaskName, options: Record<string, unknown>): PrintTaskLike;
    /** True once the printer has finished every page. */
    printEnd(): Promise<boolean>;
  };
  /** Clients that encode pages themselves (cat printers); NIIMBOT pages go through niimbluelib's encoder. */
  encodePage?(canvas: HTMLCanvasElement): unknown;
}

export type ConnectionKind = 'bluetooth' | 'serial' | 'demo';

export const supportsBluetooth = (): boolean => typeof navigator !== 'undefined' && 'bluetooth' in navigator;
export const supportsSerial = (): boolean => typeof navigator !== 'undefined' && 'serial' in navigator;

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent, touchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints): Platform {
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Why a connection type cannot be used in this browser, in a few words, or
 * null when it can. iOS browsers all run on WebKit, which has neither Web
 * Bluetooth nor Web Serial; Bluefy adds Web Bluetooth there.
 */
export function unsupportedReason(kind: ConnectionKind, platform: Platform = detectPlatform()): string | null {
  if (kind === 'demo') return null;
  if (kind === 'bluetooth' ? supportsBluetooth() : supportsSerial()) return null;
  if (platform === 'ios') return kind === 'bluetooth' ? 'On iPhone and iPad, use the Bluefy browser' : 'Not available on iPhone and iPad';
  if (platform === 'android') return 'Open niimai in Chrome';
  return 'Needs Chrome or Edge';
}
