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
    labelRfidInfo?: { tagPresent?: boolean; barCode?: string; allPaper?: number; usedPaper?: number };
    paperInfo?: { valid?: boolean; paperWidth?: number; paperHeight?: number };
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
}

export type ConnectionKind = 'bluetooth' | 'serial' | 'demo';

export const supportsBluetooth = (): boolean => typeof navigator !== 'undefined' && 'bluetooth' in navigator;
export const supportsSerial = (): boolean => typeof navigator !== 'undefined' && 'serial' in navigator;
