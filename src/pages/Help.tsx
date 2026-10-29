import { Bluetooth, Bug, Cable, Cat, Crosshair, Keyboard, LayoutTemplate, Mail, Printer, ScanLine, Sparkles } from 'lucide-react';
import { CAT_MODELS, CAT_UNSUPPORTED, type Confidence } from '../printer/cat';
import { ESCPOS_MODELS } from '../printer/escpos';
import { replayTour } from '../tour/Tour';
import { shortcutLabel } from '../shortcuts/shortcuts';
import { CONTACT_EMAIL, ISSUES_URL } from '../ui/links';
import { PageShell } from './PageShell';

const CONFIDENCE: Record<Confidence, string> = { tested: 'Tested', high: 'High', medium: 'Medium' };

const SHORTCUTS: [string, string][] = [
  ['Mod+N', 'New label'],
  ['Mod+O', 'Open file'],
  ['Mod+S', 'Save'],
  ['Mod+Shift+S', 'Save as'],
  ['Mod+P', 'Print'],
  ['Mod+L', 'Library'],
  ['Mod+E', 'Print preview'],
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
          niimai is made for NIIMBOT, and also prints on small 58 mm Bluetooth thermal printers: ESC/POS mini printers and
          cat printers. Connect them with Bluetooth like any other printer. They print on continuous paper up to 48 mm wide;
          set the label's length in the side panel.
        </p>
        <table className="shortcuts">
          <tbody>
            {[...ESCPOS_MODELS, ...CAT_MODELS].map((m) => (
              <tr key={m.prefix}>
                <td>{m.prefix}</td>
                <td>{CONFIDENCE[m.confidence]}</td>
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
