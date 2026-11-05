/**
 * Lining up a sticker roll without a ruler. A long scale is printed as if
 * on continuous paper, starting wherever the paper sits: a millimetre scale
 * down the middle and rows of millimetre marks across the head. The backing
 * between stickers takes no print, so the scale shows only on the stickers,
 * and their edges can be read straight off it.
 */
import { createDoc, createElement, type LabelDoc, type LabelElement } from '../doc/model';
import { LINED_UP_MM, MAX_GAP_MM, MAX_LENGTH_MM, MAX_PAPER_MM, MIN_LENGTH_MM, MIN_PAPER_MM } from './thermalPaper';

/** How far the print may move along the head on printers that cannot sense the paper. */
export const MAX_OFFSET_MM = 20;
/** Down the scale, a number every this many mm; across, every twice that. */
const NUMBER_EVERY = 5;
/** Rows of marks across the head, this far apart down the scale. */
const ROW_EVERY = 10;

/** How much longer than the length given a sticker may turn out to be. */
export const SIZE_SLACK_MM = 15;
/** Room for the gap between stickers, at the least. */
const GAP_ROOM_MM = 5;

/**
 * How long a scale to print for stickers about `about` mm long. The
 * readings need one sticker's top and bottom and the next sticker's top.
 * Printing can start just past a top, so the first whole top may be a full
 * step in, and the next top is one more step on: two steps of the longest
 * sticker the guess allows, and a little more to read the last edge.
 */
export const scaleLength = (about: number, gap: number): number =>
  Math.min(400, Math.max(40, Math.ceil(2 * (about + SIZE_SLACK_MM + Math.max(gap, GAP_ROOM_MM)) + 3)));

/** The scale as a label the head's full width and `lengthMm` long. Numbers count mm from where the print starts. */
export function scaleDoc(widthMm: number, lengthMm: number): LabelDoc {
  const size = { widthMm, heightMm: lengthMm };
  const doc = createDoc(size, 'Sticker scale');
  const els: LabelElement[] = [];
  const line = (x: number, y: number, len: number, vertical: boolean, stroke = 0.2) =>
    els.push({
      ...createElement('line', size),
      ...(vertical ? { x: x - 0.5, y, w: 1, h: len, direction: 'vertical' } : { x, y: y - 0.5, w: len, h: 1, direction: 'horizontal' }),
      strokeWidth: stroke,
    } as LabelElement);
  const text = (x: number, y: number, value: string) =>
    els.push({ ...createElement('text', size), x: x - 3, y: y - 1.1, w: 6, h: 2.2, text: value, autoFit: true, bold: true } as LabelElement);

  // Down the middle: a mark every mm, longer every 5 and 10, numbered every 5.
  const cx = widthMm / 2;
  line(cx, 0, lengthMm, true, 0.25);
  for (let mm = 0; mm <= lengthMm; mm++) {
    const half = mm % 10 === 0 ? 2 : mm % 5 === 0 ? 1.4 : 0.8;
    line(cx - half, mm, half * 2, false);
    if (mm % NUMBER_EVERY === 0 && mm > 0 && mm <= lengthMm - 1.2) text(cx + 5, mm, String(mm));
  }

  // Across the head: a mark every mm, numbered every 10, leaving a lane clear for the numbers down the middle.
  const lane = (mm: number) => mm > cx - 1.5 && mm < cx + 9;
  for (let y = ROW_EVERY / 4; y < lengthMm - 3; y += ROW_EVERY) {
    for (let mm = 0; mm <= Math.floor(widthMm); mm++) {
      if (lane(mm)) continue;
      const len = mm % 10 === 0 ? 2.2 : mm % 5 === 0 ? 1.6 : 1;
      line(mm, y, len, true);
      if (mm % (NUMBER_EVERY * 2) === 0 && mm > 0 && !lane(mm - 1.5) && !lane(mm + 1.5)) text(mm, y + 3.4, String(mm));
    }
  }
  return { ...doc, elements: els };
}

/** What the scale shows, read off its numbers in mm where the sticker edges cut it off. */
export interface ScaleReadings {
  /** Across a sticker: its left and right edges. */
  left: number;
  right: number;
  /** Down the scale: one sticker's top and bottom edges, the next sticker's top, and the top of the last sticker on the scale. */
  top: number;
  bottom: number;
  next: number;
  last: number;
}

export interface StickerSetup {
  width: number;
  length: number;
  gap: number;
  /** Print position across the head; positive moves the print right. */
  offsetX: number;
  offsetY: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The sticker size, gap and print position the scale shows, and how far to
 * move the paper so the next sticker's top edge sits on the print head; or
 * what is wrong with the numbers.
 *
 * Across, the scale counts from the head's left end: the sticker spans its
 * two edges, and a sticker off the head's centre moves the print sideways.
 * Down, the gap and the length are taken exactly as read: one sticker's
 * bottom minus its top, and the next top minus that bottom. The scale ended
 * at `printedMm`, where the paper stopped; the next top after that is found
 * from the last top on the scale when it sits a whole number of stickers on
 * from the first, else from the next top.
 */
export function fromScale(r: ScaleReadings, headMm: number, printedMm: number, canRetract = false): (StickerSetup & { feedMm: number }) | { error: string } {
  const width = r.right - r.left;
  const length = r.bottom - r.top;
  if (!(width > 0)) return { error: 'The right edge must read more than the left.' };
  if (!(length > 0)) return { error: "The sticker's bottom must read more than its top." };
  if (!(r.next >= r.bottom)) return { error: "The next sticker's top must read more than this one's bottom." };
  if (r.last > printedMm) return { error: `The scale ends at ${printedMm}; the last top must be on it.` };
  const gap = r.next - r.bottom;
  const step = r.next - r.top;
  // A last top that does not land a whole number of stickers on was misread, so it is left out.
  const stickers = Math.round((r.last - r.top) / step);
  const base = stickers >= 1 && Math.abs(r.last - r.top - stickers * step) <= 1.5 ? r.last : r.next;

  // The next top edge at or after where the paper stopped.
  const ahead = (((base - printedMm) % step) + step) % step;
  const back = step - ahead;
  let feed = ahead;
  if (ahead < 0.05 || back < 0.05) feed = 0;
  else if (canRetract && back < ahead) feed = -back;
  // Forward-only printers keep a head just past a top rather than push out a blank sticker.
  else if (!canRetract && back <= LINED_UP_MM) feed = 0;

  return {
    width: round1(clamp(width, MIN_PAPER_MM, MAX_PAPER_MM)),
    length: round1(clamp(length, MIN_LENGTH_MM, MAX_LENGTH_MM)),
    gap: round1(clamp(gap, 0, MAX_GAP_MM)),
    offsetX: Math.round(clamp((r.left + r.right) / 2 - headMm / 2, -MAX_OFFSET_MM, MAX_OFFSET_MM) * 100) / 100,
    // Read straight off the paper, the stickers now start where the print does.
    offsetY: 0,
    feedMm: round1(feed),
  };
}
