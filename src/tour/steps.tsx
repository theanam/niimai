import type { ReactNode } from 'react';
import { TEMPLATES } from '../templates';
import { CATEGORIES } from '../templates/kinds';
import { CanvasVisual, DitherVisual, FilesVisual, FontsIconsVisual, KeysVisual, PrinterVisual, ReadyVisual, TemplatesVisual, WelcomeVisual } from './visuals';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  highlights: string[];
  Visual: () => ReactNode;
}

/**
 * The first-run tour. Every notable feature gets a step or a highlight here;
 * add new ones when they ship (see CLAUDE.md).
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to niimai',
    body: 'Design labels and print them on your NIIMBOT printer, all inside the browser.',
    highlights: ['Free and open source', 'Works on desktop and Android phones', 'Your labels stay on your device'],
    Visual: WelcomeVisual,
  },
  {
    id: 'printer',
    title: 'Connect in one click',
    body: 'Pair over Bluetooth or USB straight from the browser. niimai recognises your model and reads the loaded roll.',
    highlights: ['Roll size, paper type and labels left, read from the RFID tag', 'Warns when your design does not match the loaded roll', 'Demo printer to try everything first', 'Cat printers work too, as an extra'],
    Visual: PrinterVisual,
  },
  {
    id: 'templates',
    title: `${TEMPLATES.length.toLocaleString()} ready-made templates`,
    body: `Pantry jars, cable flags, asset tags, shipping labels and more, across ${CATEGORIES.length} categories.`,
    highlights: ['Search from the start screen or the Templates button', 'Laid out for the roll you have loaded', 'Icon versions for most labels, all editable'],
    Visual: TemplatesVisual,
  },
  {
    id: 'design',
    title: 'Design right on the label',
    body: 'Add text, images, icons, QR codes, barcodes, frames and shapes. Double-click any text to type straight onto the label.',
    highlights: ['Smart guides snap to edges and centres', 'Text shrinks to fit its box as you type', '11 frame styles, from double lines to tickets and scallops', 'Cable flags: blank tail, matching or different sides'],
    Visual: CanvasVisual,
  },
  {
    id: 'fonts-icons',
    title: 'Every Google Font, 1,500 icons',
    body: 'Browse all Google Fonts by category with live previews, and Phosphor icons in weights tuned for thermal print.',
    highlights: ['Fonts preview in their own face', 'Bold and Fill icons stay crisp on small labels', 'QR codes, EAN-13, UPC-A, Code 128 and Code 39'],
    Visual: FontsIconsVisual,
  },
  {
    id: 'preview',
    title: 'See every dot before it prints',
    body: 'Thermal printers print black dots only. The preview shows the exact pattern your printer will produce.',
    highlights: ['Photos are dithered for print', 'Adjust darkness per image', 'Flags details too fine for the printer, and edges it cannot reach'],
    Visual: DitherVisual,
  },
  {
    id: 'files',
    title: 'Yours to keep',
    body: 'Labels save automatically to a library on this device. Save them as files to share, or print from the browser as a sharp vector page.',
    highlights: ['Saves straight back to the same file in Chrome and Edge', 'Every label you make waits in the library', 'Browser print at the exact label size'],
    Visual: FilesVisual,
  },
  {
    id: 'keys',
    title: 'Fast with the keyboard',
    body: 'The shortcuts you already know work here, plus a few for labels.',
    highlights: ['Arrow keys nudge by 0.1 mm, Shift for 1 mm', 'Hold Alt to drag without snapping', 'Paste images straight from the clipboard'],
    Visual: KeysVisual,
  },
  {
    id: 'ready',
    title: 'Ready when you are',
    body: 'Connect your printer, start from a blank label or pick a template. Help is always one click away in the top bar.',
    highlights: [],
    Visual: ReadyVisual,
  },
];
