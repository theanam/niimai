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
  /**
   * Label printers that cannot sense the roll: a key to remember the roll
   * size the user sets, per printer. NIIMBOT printers read their rolls instead.
   */
  rollKey?(): string;
  /** Printers that cannot sense the paper: moves it by `dots`, back into the printer when negative. */
  feedPaper?(dots: number): Promise<void>;
  /** feedPaper can also move the paper back. */
  feedsBack?: boolean;
  /**
   * Bluetooth: the kind of printer to treat one with an unknown name as, set
   * before connecting: an id from PRINTER_TYPES, or a NIIMBOT profile id the
   * client ignores.
   */
  unrecognisedAs?(typeId: string | null): void;
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

export type OperatingSystem = 'ios' | 'android' | 'chromeos' | 'linux' | 'mac' | 'windows' | 'other';
export type BrowserName = 'chrome' | 'edge' | 'opera' | 'brave' | 'samsung' | 'bluefy' | 'firefox' | 'safari' | 'other';

export interface BrowserInfo {
  os: OperatingSystem;
  browser: BrowserName;
  /** Built on Chromium, so Web Bluetooth and Web Serial can be there. */
  chromium: boolean;
  /** Served over https or from localhost; browsers hide both APIs elsewhere. */
  secure: boolean;
}

/** What the browser tells about itself. Defaults to the running browser. */
export interface BrowserEnv {
  ua: string;
  touchPoints: number;
  /** Brave hides itself in the user agent; it has `navigator.brave` instead. */
  brave: boolean;
  secure: boolean;
}

function currentEnv(): BrowserEnv {
  if (typeof navigator === 'undefined') return { ua: '', touchPoints: 0, brave: false, secure: true };
  return {
    ua: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints,
    brave: 'brave' in navigator,
    secure: typeof window === 'undefined' || window.isSecureContext !== false,
  };
}

export function detectBrowser(env: Partial<BrowserEnv> = {}): BrowserInfo {
  const { ua, touchPoints, brave, secure } = { ...currentEnv(), ...env };
  const platform = detectPlatform(ua, touchPoints);
  const os: OperatingSystem =
    platform !== 'desktop' ? platform : /CrOS/.test(ua) ? 'chromeos' : /Windows/.test(ua) ? 'windows' : /Macintosh|Mac OS X/.test(ua) ? 'mac' : /Linux|X11|BSD/.test(ua) ? 'linux' : 'other';
  const browser: BrowserName = brave
    ? 'brave'
    : /Bluefy/i.test(ua)
      ? 'bluefy'
      : /Firefox|FxiOS/.test(ua)
        ? 'firefox'
        : /Edg(e|A|iOS)?\//.test(ua)
          ? 'edge'
          : /OPR\/|Opera/.test(ua)
            ? 'opera'
            : /SamsungBrowser/.test(ua)
              ? 'samsung'
              : /Chrome\/|CriOS|Chromium/.test(ua)
                ? 'chrome'
                : /Safari\//.test(ua)
                  ? 'safari'
                  : 'other';
  // Every iOS browser runs on WebKit, whatever its name.
  const chromium = os !== 'ios' && /Chrome\/|Chromium/.test(ua);
  return { os, browser, chromium, secure };
}

/**
 * A Help topic that shows how to get a connection type working:
 * - `linux`: Chrome and other Chromium browsers on Linux need a flag for Bluetooth.
 * - `brave`: Brave keeps Bluetooth and USB behind flags.
 * - `ios`: iPhone and iPad browsers, and Bluefy.
 * - `https`: the page has to be served over https.
 * - `browsers`: which browsers work.
 */
export type SetupTopic = 'linux' | 'brave' | 'ios' | 'https' | 'browsers';

export interface SupportIssue {
  /** In a few words, what is missing or what to do. */
  reason: string;
  topic: SetupTopic;
}

const BROWSER_NAMES: Partial<Record<BrowserName, string>> = { firefox: 'Firefox', safari: 'Safari', samsung: 'Samsung Internet', opera: 'Opera' };

/**
 * Why a connection type cannot be used in this browser, and where to read how
 * to fix it, or null when it can be used.
 */
export function supportIssue(kind: ConnectionKind, env: Partial<BrowserEnv> = {}): SupportIssue | null {
  if (kind === 'demo') return null;
  if (kind === 'bluetooth' ? supportsBluetooth() : supportsSerial()) return null;
  const { os, browser, chromium, secure } = detectBrowser(env);
  const bluetooth = kind === 'bluetooth';
  if (os === 'ios') return { reason: bluetooth ? 'On iPhone and iPad, use the Bluefy browser' : 'Not available on iPhone and iPad', topic: 'ios' };
  if (!secure && chromium) return { reason: 'Needs an https page', topic: 'https' };
  if (browser === 'brave') return { reason: 'Turn it on in Brave flags', topic: 'brave' };
  if (os === 'android') {
    if (!bluetooth) return { reason: 'Needs Chrome or Edge on a computer', topic: 'browsers' };
    return { reason: browser === 'chrome' ? 'Update Chrome' : 'Open niimai in Chrome', topic: 'browsers' };
  }
  if (bluetooth && os === 'linux' && chromium) return { reason: 'Needs a Chrome flag on Linux', topic: 'linux' };
  const name = BROWSER_NAMES[browser];
  if (name) return { reason: `${name} has no ${bluetooth ? 'Bluetooth' : 'USB'} access; use Chrome or Edge`, topic: 'browsers' };
  if (chromium) return { reason: 'Turned off in this browser', topic: 'browsers' };
  return { reason: 'Needs Chrome or Edge', topic: 'browsers' };
}

/** Stand-ins for the platform-only signature below. */
const PLATFORM_ENVS: Record<Platform, Partial<BrowserEnv>> = {
  ios: { ua: 'iPhone', touchPoints: 5, brave: false },
  android: { ua: 'Android Firefox', touchPoints: 5, brave: false },
  desktop: { ua: '', touchPoints: 0, brave: false },
};

/** supportIssue's reason alone. */
export function unsupportedReason(kind: ConnectionKind, platform?: Platform): string | null {
  return supportIssue(kind, platform ? PLATFORM_ENVS[platform] : {})?.reason ?? null;
}

/**
 * Errors browsers raise when Bluetooth is there but cannot be used: the
 * adapter is off or missing, or the browser turned the API off. The Help topic
 * to point to, or null.
 */
export function connectErrorTopic(err: unknown): SetupTopic | null {
  const message = err instanceof Error ? err.message : String(err);
  if (/globally disabled/i.test(message)) return 'brave';
  if (/adapter not available|Bluetooth adapter|Bluetooth is (turned off|disabled|not available)/i.test(message)) return detectBrowser().os === 'linux' ? 'linux' : 'browsers';
  return null;
}
