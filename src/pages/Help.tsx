import { Bluetooth, Bug, Cable, Keyboard, LayoutTemplate, Mail, Printer, ScanLine, Sparkles } from 'lucide-react';
import { replayTour } from '../tour/Tour';
import { shortcutLabel } from '../shortcuts/shortcuts';
import { CONTACT_EMAIL, ISSUES_URL } from '../ui/links';
import { PageShell } from './PageShell';

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
        <p>Bluetooth and USB printing work in Chrome and Edge on desktop and Android.</p>
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
          If connecting fails with an unknown Bluetooth service, open <code>chrome://bluetooth-internals</code>, connect to
          the printer under Devices, and include the service and characteristic IDs it lists in an issue.
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
          <LayoutTemplate size={18} /> Templates
        </h2>
        <p>
          Open the library and switch to Templates. It shows every template laid out for your current label size. Choose
          All sizes to browse the full catalog.
        </p>
        <p>
          The icon button in the toolbar opens 1,500 icons. Bold and Fill print best on small labels; Regular suits larger ones.
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
