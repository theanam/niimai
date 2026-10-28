import type { PrinterModelMeta, PrintTaskName } from '@mmote/niimbluelib';

export type PrintDirection = 'left' | 'top';

/** Everything the app needs to know to render and send a page to a printer. */
export interface PrinterProfile {
  id: string;
  name: string;
  dpi: number;
  printheadPixels: number;
  printDirection: PrintDirection;
  printTask: PrintTaskName;
  densityMin: number;
  densityMax: number;
  densityDefault: number;
}

/** Manual profiles for printers niimbluelib does not recognise yet. Each mirrors a known model family. */
export const MANUAL_PROFILES: PrinterProfile[] = [
  { id: 'd11', name: 'D11 family', dpi: 203, printheadPixels: 96, printDirection: 'left', printTask: 'D11_V1', densityMin: 1, densityMax: 3, densityDefault: 2 },
  { id: 'd110', name: 'D110 family', dpi: 203, printheadPixels: 96, printDirection: 'left', printTask: 'D110', densityMin: 1, densityMax: 3, densityDefault: 2 },
  { id: 'b1', name: 'B1 family', dpi: 203, printheadPixels: 384, printDirection: 'top', printTask: 'B1', densityMin: 1, densityMax: 5, densityDefault: 3 },
  { id: 'b21', name: 'B21 family', dpi: 203, printheadPixels: 384, printDirection: 'top', printTask: 'B21_V1', densityMin: 1, densityMax: 5, densityDefault: 3 },
];

export const findManualProfile = (id: string | null | undefined): PrinterProfile | undefined =>
  MANUAL_PROFILES.find((p) => p.id === id);

/**
 * Print tasks verified on hardware where niimbluelib's choice prints blank.
 * A B21 C2B on protocol 0 needs the original B21 packet formats; the library
 * gives every B21 C2B the B1 task, which that firmware accepts but never prints.
 */
const TASK_QUIRKS: { model: string; maxProtocol: number; task: PrintTaskName }[] = [{ model: 'B21_C2B', maxProtocol: 0, task: 'B21_V1' }];

export function correctTask(model: string, protocolVersion: number | undefined, task: PrintTaskName | undefined): PrintTaskName | undefined {
  const quirk = TASK_QUIRKS.find((q) => q.model === model && (protocolVersion ?? 0) <= q.maxProtocol);
  return quirk?.task ?? task;
}

/**
 * The profile to print with: the library's model data when it recognises the
 * printer, otherwise the manual choice. A detected model always wins, so a
 * choice left over from another printer cannot send the wrong settings.
 */
export function resolveProfile(
  meta: PrinterModelMeta | undefined,
  libraryTask: PrintTaskName | undefined,
  manual?: PrinterProfile,
  protocolVersion?: number,
): PrinterProfile | null {
  const task = meta ? correctTask(meta.model, protocolVersion, libraryTask) : undefined;
  if (!meta || !task) return manual ?? null;
  return {
    id: `auto:${meta.model}`,
    name: meta.model.replace(/_/g, ' '),
    dpi: meta.dpi,
    printheadPixels: meta.printheadPixels,
    printDirection: meta.printDirection,
    printTask: task,
    densityMin: meta.densityMin,
    densityMax: meta.densityMax,
    densityDefault: meta.densityDefault,
  };
}

/** Widest label edge the printhead covers, in millimetres. */
export const printheadMm = (p: PrinterProfile): number => (p.printheadPixels / p.dpi) * 25.4;

/**
 * The part of a page the printhead can print, centred across the head. Pages
 * wider than the head are cropped: printers discard rows longer than the head.
 */
export function printheadCrop(width: number, height: number, p: Pick<PrinterProfile, 'printheadPixels' | 'printDirection'>) {
  const acrossIsWidth = p.printDirection === 'top';
  const across = acrossIsWidth ? width : height;
  const keep = Math.min(across, p.printheadPixels);
  const offset = Math.floor((across - keep) / 2);
  return acrossIsWidth
    ? { x: offset, y: 0, width: keep, height, cropped: keep < across }
    : { x: 0, y: offset, width, height: keep, cropped: keep < across };
}
