import { Bluetooth, Braces, Bug, Cable, Cat, Crosshair, Keyboard, LayoutTemplate, Mail, Printer, RectangleHorizontal, ScanLine, Sparkles } from 'lucide-react';
import { CAT_MODELS, CAT_UNSUPPORTED, type Confidence, ESCPOS_MODELS, type ThermalModel, TSPL_MODELS } from 'libniimai';
import { replayTour } from '../tour/Tour';
import { shortcutLabel } from '../shortcuts/shortcuts';
import { CONTACT_EMAIL, ISSUES_URL } from '../ui/links';
import { PageShell } from './PageShell';

const CONFIDENCE: Record<Confidence, string> = { tested: 'Tested', high: 'High', medium: 'Medium' };

const MODEL_FAMILIES = [
  { name: 'Receipt printers', models: ESCPOS_MODELS },
  { name: 'Cat printers', models: CAT_MODELS },
  { name: 'Label printers', models: TSPL_MODELS },
];

/** A family's models by confidence, by name, each brand or alias once (the most confident one). */
function modelNames(models: ThermalModel[]): [Confidence, string][] {
  const seen = new Set<string>();
  return (['tested', 'high', 'medium'] as const)
    .map((level): [Confidence, string] => [
      level,
      models
        .filter((m) => m.confidence === level)
        .filter((m) => {
          const keys = [m.prefix, m.brand ?? m.prefix].map((k) => k.toLowerCase());
          if (keys.some((k) => seen.has(k))) return false;
          keys.forEach((k) => seen.add(k));
          return true;
        })
        // Hyphens never break a model name across lines.
        .map((m) => (m.brand?.includes(m.prefix) ? m.brand : m.brand ? `${m.prefix} (${m.brand})` : m.prefix).replace(/-/g, '\u2011'))
        .join(', '),
    ])
    .filter(([, names]) => names);
}

const SHORTCUTS: [string, string][] = [
  ['Mod+N', 'New label'],
  ['Mod+O', 'Open file'],
  ['Mod+S', 'Save'],
  ['Mod+Shift+S', 'Save as'],
  ['Mod+P', 'Print'],
  ['Mod+L', 'Library'],
  ['Mod+E', 'Print preview'],
  ['Mod+= / −', 'Zoom in, zoom out'],
  ['Mod+0', 'Fit the label to the view'],
  ['Mod+Z', 'Undo'],
  ['Mod+Shift+Z', 'Redo'],
  ['Mod+C / X / V', 'Copy, cut, paste'],
  ['Mod+D', 'Duplicate'],
  ['Enter / double-click', 'Edit text'],
  ['Esc', 'Finish editing'],
  ['Delete', 'Delete'],
  ['Arrows', 'Nudge 0.1 mm'],
  ['Shift+Arrows', 'Nudge 1 mm'],
  ['Alt (drag)', 'Move without snapping'],
  ['Shift (resize)', 'Keep proportions'],
];

export function Help() {
  return (
    <PageShell title="Help">
      <p>
        <button
          className="btn"
          onClick={() => {
            window.location.hash = '#/';
            replayTour();
          }}
        >
          <Sparkles size={16} /> Replay tour
        </button>
      </p>
      <section>
        <h2>
          <Bluetooth size={18} /> Connecting
        </h2>
        <ol>
          <li>Turn the printer on.</li>
          <li>Click the printer button in the top bar and choose Bluetooth or USB.</li>
          <li>Pick your printer from the browser's list.</li>
        </ol>
        <p>
          Bluetooth printing works in Chrome and Edge on desktop, and in Chrome on Android. USB works in Chrome and Edge on
          desktop; niimai shows the USB option wherever the browser supports it. iPhone and iPad browsers cannot reach
          printers; the Bluefy browser adds Bluetooth on iOS. Designing labels works everywhere.
        </p>
      </section>
      <section>
        <h2>
          <ScanLine size={18} /> Printer not recognised?
        </h2>
        <p>
          Some models are not in the protocol library yet. Open printer settings and choose the closest printer type. The
          D11 family suits most small handheld models.
        </p>
        <p>
          Receipt and label printers often keep a stock Bluetooth name, such as Printer001. If one does not connect, choose
          Receipt printer or Label printer under Advanced, then connect again; Bluetooth then lists every nearby device.
        </p>
        <p>
          niimai recognises over 60 NIIMBOT rolls from the barcode on their tag. If yours is not one of them, it asks for the
          size once and remembers it.
        </p>
        <p>
          If connecting fails with an unknown Bluetooth service, open <code>chrome://bluetooth-internals</code>, connect to
          the printer under Devices, and include the service and characteristic IDs it lists in an issue.
        </p>
      </section>
      <section>
        <h2>
          <Crosshair size={18} /> Print off-centre?
        </h2>
        <p>
          First check the label matches the roll. When the design's size or paper differs from what the printer has
          loaded, a banner above the label says so; choose Match the roll.
        </p>
        <p>
          Then open the printer panel and choose Print test. It prints a millimetre ruler at each end of the label. If one
          end is cut off, move the print away from that end by the first number you can read, using Move right or Move
          down. niimai remembers the offset for each printer model.
        </p>
        <p>If a print lands across two labels after reloading the roll, print once more; the printer finds the gap again.</p>
      </section>
      <section>
        <h2>
          <RectangleHorizontal size={18} /> Landscape
        </h2>
        <p>
          Choose Landscape in the label settings to design across the length of the roll. The label panel keeps showing the
          roll, the canvas turns a quarter, and the print window shows the label the way it comes out of the printer.
        </p>
      </section>
      <section>
        <h2>
          <Cable size={18} /> Cable labels
        </h2>
        <p>
          Cable flag rolls, such as the T12.5 × 74+35, have a tail that wraps around the cable. niimai recognises known rolls
          and shades the tail so your design stays on the flag. For other rolls, switch on Cable in the label settings and
          set the tail length.
        </p>
        <p>
          Flags that fold in the middle show a dashed fold line. Choose Same to repeat your design on both sides, Flipped to
          repeat it upside down, or Separate to design each side on its own.
        </p>
      </section>
      <section>
        <h2>
          <Braces size={18} /> Batches and dynamic text
        </h2>
        <p>
          Select a text, QR code or barcode and turn on the switch in its Dynamic section. The content shows as tags: each
          field and each piece of text has its own × to remove it. The chips below add fields, and clicking a field's tag
          opens its options.
        </p>
        <ul>
          <li>
            <strong>Sheet columns.</strong> Add a CSV or Excel (.xlsx) file under Data in the label settings. Its first row
            names the columns, and every row below prints one label. Step through rows with the arrows under the label.
          </li>
          <li>
            <strong>Number</strong> counts up on each label. Its options set the start, an optional end, the step and the
            digits. With an end, the print dialog prints the whole range; the next run carries on after it.
          </li>
          <li>
            <strong>Date</strong> and <strong>Time</strong> fill in when you print. A date can be days from today, handy for
            best-before labels, in formats from 30 Oct 2026 to 2026-10-30 or 10/2026. Time can be 12- or 24-hour.
          </li>
        </ul>
        <p>In the print dialog, choose which rows to print, or how many numbers. Copies repeat each label.</p>
      </section>
      <section>
        <h2>
          <LayoutTemplate size={18} /> Templates
        </h2>
        <p>
          Search templates on the start screen, or press Templates in the top bar. Templates are laid
          out for your current label size; choose All sizes to browse the full catalogue.
        </p>
        <p>
          The icon button in the toolbar opens 1,500 icons. Bold and Fill print best on small labels; Regular suits larger ones.
        </p>
        <p>
          The frame button adds a border around the label. Pick a style when you add it, and switch styles or stroke width
          from the side panel. Frames sit behind everything else.
        </p>
      </section>
      <section>
        <h2>
          <Printer size={18} /> Printing
        </h2>
        <p>
          Everything prints in black and white. Use the preview toggle to see exactly which dots will print, and the
          image darkness slider to tune photos and logos. Browser printing produces a vector document sized to the label.
        </p>
        <p>
          Some labels are wider than the printhead. Once a printer is connected, the strips it cannot reach are shaded on
          the label, and borders move inside the printable area. Small templates come without borders.
        </p>
        <p>
          The screen shows everything crisply, but a thermal printer prints in dots about 0.13 mm wide. Lines, letters,
          icon strokes and barcode bars finer than that fade or vanish, so niimai marks them with an amber badge and the
          side panel says what to change.
        </p>
        <p>
          The image tool takes PNG, JPEG, GIF, WebP and SVG files. You can also drop them on the label, or paste SVG code
          copied from a design app. SVGs stay vector in browser printing.
        </p>
        <p>Lines run horizontal, vertical or diagonal; pick the direction in the side panel and drag the handles to set the angle.</p>
      </section>
      <section>
        <h2>
          <Cat size={18} /> Other Bluetooth thermal printers
        </h2>
        <p>
          niimai is made for NIIMBOT, and also prints on ESC/POS receipt printers, cat printers and TSPL label printers.
          Connect them with Bluetooth like any other printer.
        </p>
        <p>
          Receipt and cat printers print on continuous paper, 48 mm wide on 58 mm printers and 72 mm on 80 mm ones; set
          the label's length in the side panel or the printer window. For sticker rolls, open the printer window, set
          Paper to Stickers and enter the gap and the sticker size. Feed there lines the paper up.
        </p>
        <p>TSPL label printers up to 80 mm wide work like a NIIMBOT: pick the roll size and paper type, and the printer finds each label's edge.</p>
        <table className="shortcuts help-models">
          <tbody>
            {MODEL_FAMILIES.map(({ name, models }) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>
                  {modelNames(models).map(([level, names]) => (
                    <span key={level} className="help-models-level">
                      <span className="muted">{CONFIDENCE[level]}:</span> {names}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          Tested: printed with niimai. High: well known to work. Medium: reported to work, fewer reports.{' '}
          {CAT_UNSUPPORTED.map((u) => u.name).join(', ')} use other protocols and are not supported.
        </p>
      </section>
      <section>
        <h2>
          <Keyboard size={18} /> Shortcuts
        </h2>
        <table className="shortcuts">
          <tbody>
            {SHORTCUTS.map(([keys, label]) => (
              <tr key={keys}>
                <td>
                  <kbd>{shortcutLabel(keys)}</kbd>
                </td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Still stuck?</h2>
        <p className="link-row">
          <a className="btn" href={ISSUES_URL} target="_blank" rel="noreferrer">
            <Bug size={16} /> Report an issue
          </a>
          <a className="btn" href={`mailto:${CONTACT_EMAIL}`}>
            <Mail size={16} /> {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </PageShell>
  );
}
