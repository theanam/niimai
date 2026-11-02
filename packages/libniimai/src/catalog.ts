/**
 * Every printer outside NIIMBOT that libniimai knows, by Bluetooth name, in
 * one lookup across families. A name matches one family at most, and a name
 * that matches none is known to be unknown before anything is sent to it.
 * The models themselves live with their family: ESCPOS_MODELS, TSPL_MODELS
 * and CAT_MODELS.
 */
import { CAT_MODELS } from './cat';
import { ESCPOS_MODELS } from './escpos';
import { THERMAL_HEAD_DOTS, type ThermalModel } from './thermal';
import { TSPL_HEAD_DOTS, TSPL_MODELS } from './tspl';

export type PrinterFamily = 'escpos' | 'tspl' | 'cat';

export interface CatalogEntry {
  family: PrinterFamily;
  model: ThermalModel;
}

export const PRINTER_CATALOG: CatalogEntry[] = [
  ...ESCPOS_MODELS.map((model) => ({ family: 'escpos' as const, model })),
  ...TSPL_MODELS.map((model) => ({ family: 'tspl' as const, model })),
  ...CAT_MODELS.map((model) => ({ family: 'cat' as const, model })),
];

/** The known printer a Bluetooth name belongs to, longest prefix first across every family. */
export function identifyPrinter(name: string | undefined): CatalogEntry | null {
  if (!name) return null;
  let best: CatalogEntry | null = null;
  for (const entry of PRINTER_CATALOG) {
    if (name.startsWith(entry.model.prefix) && entry.model.prefix.length > (best?.model.prefix.length ?? 0)) best = entry;
  }
  return best;
}

/** A kind of printer to pick for one niimai does not recognise. */
export interface PrinterType extends CatalogEntry {
  id: string;
  name: string;
}

/** The kinds of printer an unrecognised one can be set to, alongside NIIMBOT's MANUAL_PROFILES. */
export const PRINTER_TYPES: PrinterType[] = [
  { id: 'escpos-58', name: 'Receipt printer, 58 mm', family: 'escpos', model: { prefix: '', confidence: 'medium', generic: true, headDots: THERMAL_HEAD_DOTS } },
  { id: 'escpos-80', name: 'Receipt printer, 80 mm', family: 'escpos', model: { prefix: '', confidence: 'medium', generic: true, headDots: 576 } },
  { id: 'tspl', name: 'Label printer (TSPL)', family: 'tspl', model: { prefix: '', confidence: 'medium', generic: true, headDots: TSPL_HEAD_DOTS } },
  { id: 'cat', name: 'Cat printer', family: 'cat', model: { prefix: '', confidence: 'medium', generic: true } },
];

export const findPrinterType = (id: string | null | undefined): PrinterType | null => PRINTER_TYPES.find((t) => t.id === id) ?? null;
