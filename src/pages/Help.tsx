import { Bluetooth, Braces, Bug, Cable, Cat, Check, Copy, Crosshair, Globe, Keyboard, LayoutTemplate, Mail, Printer, RectangleHorizontal, ScanLine, Share2, Sparkles } from 'lucide-react';
import { CAT_MODELS, CAT_UNSUPPORTED, type Confidence, detectBrowser, ESCPOS_MODELS, MARKLIFE_MODELS, type SetupTopic, supportIssue, type ThermalModel, TSPL_MODELS } from 'libniimai';
import { type ReactNode, useEffect, useState } from 'react';
import { replayTour } from '../tour/Tour';
import { shortcutLabel } from '../shortcuts/shortcuts';
import { CONTACT_EMAIL, ISSUES_URL } from '../ui/links';
import { PageShell } from './PageShell';

const CONFIDENCE: Record<Confidence, string> = { tested: 'Tested', high: 'High', medium: 'Medium' };

const MODEL_FAMILIES = [
  { name: 'Receipt printers', models: ESCPOS_MODELS },
  { name: 'Cat printers', models: CAT_MODELS },
  { name: 'Label printers', models: TSPL_MODELS },
  { name: 'Marklife printers', models: MARKLIFE_MODELS },
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
  ['Mod+A', 'Select all'],
  ['Shift (click)', 'Add to the selection'],
  ['Long press', 'Add to the selection on touch screens'],
  ['Mod+G', 'Group'],
  ['Mod+Shift+G', 'Ungroup'],
  ['Mod+Shift+L', 'Lock'],
  ['Enter / double-click', 'Edit text'],
  ['Esc', 'Finish editing'],
  ['Delete', 'Delete'],
  ['Arrows', 'Nudge 0.1 mm'],
  ['Shift+Arrows', 'Nudge 1 mm'],
  ['Alt (drag)', 'Move without snapping'],
  ['Shift (resize)', 'Keep proportions'],
];

/** The setup topic in `#/help/<topic>`, if any. */
const topicInHash = () => window.location.hash.replace(/^#\/?help\/?/, '').split(/[?/]/)[0];

/** A flag or command to paste; browsers do not open chrome:// links from a page. */
function CopyCode({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy-code">
      <code>{text}</code>
      <button
        className="icon-btn"
        aria-label={`Copy ${text}`}
        title="Copy"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

const TOPICS: SetupTopic[] = ['browsers', 'linux', 'brave', 'ios', 'https', 'usb'];

/** Which topic applies to this browser, so Help can mark it. */
function ownTopic(): SetupTopic | null {
  const issue = supportIssue('bluetooth') ?? supportIssue('serial');
  if (issue) return issue.topic;
  const { os, chromium } = detectBrowser();
  return os === 'linux' && chromium ? 'linux' : null;
}

function BrowserSetup() {
  const [target, setTarget] = useState<string>(topicInHash);
  const mine = ownTopic();
  useEffect(() => {
    const on = () => setTarget(topicInHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (!TOPICS.includes(target as SetupTopic)) return;
    document.getElementById(`setup-${target}`)?.scrollIntoView?.({ block: 'start' });
  }, [target]);
  const topic = (id: SetupTopic, title: string, body: ReactNode) => (
    <div id={`setup-${id}`} className={`setup-topic${id === target ? ' setup-target' : ''}`}>
      <h3>
        {title}
        {id === mine && <span className="setup-mine">This browser</span>}
      </h3>
      {body}
    </div>
  );
  return (
    <section>
      <h2>
        <Globe size={18} /> Browser setup
      </h2>
      {topic(
        'browsers',
        'Which browsers work',
        <>
          <p>
            Bluetooth works in Chrome, Edge and Opera on Windows, macOS and ChromeOS, and in Chrome on Android. USB works in
            the same browsers on a computer. Firefox and Safari cannot reach printers. Designing and browser printing work
            everywhere.
          </p>
          <p>If Chrome says Bluetooth is unavailable, check that Bluetooth is on in the system settings and that Chrome is up to date.</p>
        </>,
      )}
      {topic(
        'linux',
        'Chrome on Linux',
        <>
          <p>Chrome, Edge and other Chromium browsers keep Bluetooth behind a flag on Linux.</p>
          <ol>
            <li>
              Open <CopyCode text="chrome://flags/#enable-web-bluetooth" /> in a new tab. In Edge, start with{' '}
              <code>edge://</code>; in Opera, <code>opera://</code>.
            </li>
            <li>Set Web Bluetooth to Enabled and relaunch the browser.</li>
            <li>
              Still unavailable? Also enable <CopyCode text="chrome://flags/#enable-experimental-web-platform-features" />
            </li>
          </ol>
          <p>
            Bluetooth needs BlueZ 5.41 or newer with the bluetooth service running. USB works without a flag; if the port
            of a NIIMBOT cannot be opened, add yourself to the dialout group, then log out and back in. Label and receipt
            printers have their own steps under <a href="#/help/usb">USB label and receipt printers</a>.
          </p>
          <p>
            <CopyCode text="sudo usermod -aG dialout $USER" />
          </p>
        </>,
      )}
      {topic(
        'brave',
        'Brave',
        <ol>
          <li>
            Open <CopyCode text="brave://flags" /> in a new tab.
          </li>
          <li>Search for Web Bluetooth API and Web Serial API, set both to Enabled, then relaunch.</li>
          <li>
            On Linux, also enable <CopyCode text="brave://flags/#enable-web-bluetooth" />
          </li>
        </ol>,
      )}
      {topic(
        'ios',
        'iPhone and iPad',
        <p>
          Every iPhone and iPad browser runs on Safari's engine, which has no Bluetooth or USB access. The free Bluefy
          browser adds Bluetooth: install it from the App Store and open niimai.app there.
        </p>,
      )}
      {topic(
        'usb',
        'USB label and receipt printers',
        <>
          <p>
            NIIMBOT printers show up in the USB list as serial ports. Label and receipt printers usually show up as USB
            printers, in a list of their own: choose “USB printer not listed?” under the USB button. Once connected, niimai
            goes straight to that printer next time, and picking Label printer or Receipt printer under Advanced does the
            same.
          </p>
          <p>macOS and ChromeOS need nothing more.</p>
          <p>
            <strong>Windows</strong> keeps USB printers for its own printing. Install the free{' '}
            <a href="https://zadig.akeo.ie" target="_blank" rel="noreferrer">
              Zadig
            </a>
            , choose Options › List All Devices, pick the printer, choose WinUSB and press Replace Driver. Other Windows
            apps cannot use the printer until you roll the driver back in Device Manager.
          </p>
          <p>
            <strong>Linux</strong> holds USB printers with the usblp module. Unload it, then give yourself access to the
            printer, using the vendor ID <code>lsusb</code> shows (28e9 is the CC390):
          </p>
          <p>
            <CopyCode text="sudo rmmod usblp" />
          </p>
          <p>
            <CopyCode text={'echo \'SUBSYSTEM=="usb", ATTRS{idVendor}=="28e9", TAG+="uaccess"\' | sudo tee /etc/udev/rules.d/70-label-printer.rules'} />
          </p>
          <p>Unplug the printer and plug it back in.</p>
        </>,
      )}
      {topic(
        'https',
        'Secure page',
        <p>
          Browsers only allow Bluetooth and USB on https pages and on localhost. Open niimai.app, or serve your own copy
          over https.
        </p>,
      )}
    </section>
  );
}

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
          Bluetooth and USB need a supported browser, and some need a setting turned on first. <a href="#/help/browsers">Browser setup</a> shows what to do for yours.
        </p>
      </section>
      <BrowserSetup />
      <section>
        <h2>
          <ScanLine size={18} /> Printer not recognised?
        </h2>
        <p>
          Some models are not in the protocol library yet. Open printer settings and choose the closest printer type. The
          D11 family suits most small handheld models.
        </p>
        <p>
          A printer with a name niimai does not know tries NIIMBOT first, then is matched by the Bluetooth services it
          offers; most connect as receipt printers. Receipt and label printers often keep a stock Bluetooth name, such as Printer001. If one does
          not connect or prints garbled, choose
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
          Dates on templates are Date fields, so they show the day you open the label and print it; click one to change
          its format or add days. Templates leave out borders, since label printers rarely centre a label exactly; only
          warning labels keep theirs.
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
        <p>
          The box around text, images, icons and codes hugs what prints, so the size under it is the printed size. They
          resize from the corners and keep their proportions; text grows as you type.
        </p>
        <p>
          Shift-click elements, or drag across empty space, to select several. On a phone or tablet, long-press each one,
          or use Select all in the label settings. Move them together, or line them up and space them evenly from the side
          panel. With one element selected, the same buttons line it up with the label.
        </p>
        <p>
          Group keeps a selection together: a click picks the whole group, and a second click picks one element in it.
          Lock keeps an element in place, such as a background frame, and lets clicks reach what is on top of it. Locked
          elements are listed in the label settings, each with its own unlock button.
        </p>
      </section>
      <section>
        <h2>
          <Cat size={18} /> Other Bluetooth thermal printers
        </h2>
        <p>
          niimai prints on NIIMBOT printers, ESC/POS receipt printers, cat printers, TSPL label printers and Marklife label printers.
          Connect them with Bluetooth like any other printer.
        </p>
        <p>
          Receipt and cat printers print on continuous paper, 48 mm wide on 58 mm printers and 72 mm on 80 mm ones; set
          the label's length in the side panel or the printer window. For sticker rolls, open the printer window, set
          Paper to Stickers and enter the gap and the size of one sticker, leaving out the backing. Its Paper guide shows where each number comes from and where the gap goes when you load the roll. Feed lines the paper up.
        </p>
        <p>
          If prints sit off their stickers, or creep down or up the roll, open Line up stickers in the same window, give the
          sticker length roughly, and print the scale. It runs just over two stickers, starts wherever the paper sits and prints only on the stickers, so every sticker edge cuts it off at
          a number. The window then asks for those numbers one at a time, with a picture of which edge to read. Fix size,
          gap and position sets the sticker size, the gap and where the print sits, then moves the paper so the next sticker
          starts at the print head. No ruler needed.
        </p>
        <p>
          Save a paper once it prints right: Save as new paper, next to Saved paper, keeps its name, size, gap and print
          position. Loading it later sets all of them at once. Change any of them and the paper shows as changed, with
          Save to keep the change in it or Save as new to keep both.
        </p>
        <p>
          TSPL label printers up to 80 mm wide find each label's edge themselves, but not its size. Tap the sticker size on the
          start screen to set it: a common size or any size you type. Save it as a paper to load it again next time, the same
          way as above.
        </p>
        <p>
          Marklife printers work the same way. The P12 and P15 print on 12 to 15 mm tape, the P50 on stickers up to 50 mm
          wide. The P12 and P15 also print over a USB cable.
        </p>
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
          <Share2 size={18} /> Share, reprint and offline
        </h2>
        <p>
          Share link makes a link that opens a copy of the label. The label travels inside the link, so nothing is uploaded;
          labels with pictures make long links, so send those as a file.
        </p>
        <p>The Printed tab in the library keeps the last labels you printed, as they printed. Print again opens the print window for one.</p>
        <p>
          Printer settings live in this browser. To keep them, or move them to another device or browser, open the printer
          window, then Advanced, and Save to file. The file holds every printer's paper, gap, print position and the saved
          papers. Load file adds them to what is there; settings in the file replace the same ones here.
        </p>
        <p>
          Once niimai has loaded, it keeps working offline, with the fonts and icons you have used. Install it from the
          browser's menu to open it like an app.
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
