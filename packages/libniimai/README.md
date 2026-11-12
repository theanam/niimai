# libniimai

Print from the browser on five families of thermal printers: **NIIMBOT**, **TSPL label printers**, **ESC/POS receipt printers**, **cat printers** and **Marklife label printers**. One API connects, detects the printer and prints any canvas, over Web Bluetooth, Web Serial or WebUSB. No server, no drivers, no app.

libniimai powers [niimai](https://niimai.app), the label designer.

## Supported printers

| Family | Paper | Print width | Connection | Models |
|---|---|---|---|---|
| **NIIMBOT** | Labels with gaps, black mark, continuous, transparent | 12 mm and up, by model | Bluetooth, USB | D11, D110, D101, B1, B18, B21, B3S and more |
| **TSPL label printers** | Labels with gaps, black mark, continuous | Up to 80 mm | Bluetooth, USB | QR380A (sold as CC390), Gprinter GP-M322 |
| **ESC/POS receipt printers** | 58 or 80 mm, continuous or stickers with gaps | 48 or 72 mm | Bluetooth, USB | MP583, MPT-II, Xprinter XP-58IIL, PT-210, RPP02, MPT-3, MTP-4B, RPP300 and more |
| **Cat printers** | 58 mm continuous, stickers with gaps | 48 mm | Bluetooth | GB01, GB02, GB03, MX05, MX06, MX10 and more |
| **Marklife label printers** | 12–15 mm tape, stickers up to 50 mm | 12 or 48 mm | Bluetooth, USB (P12, P15) | P12, P15, P11, P50 |

The family is found from the device the user picks: by its Bluetooth name in `PRINTER_CATALOG`, then checked against the services it offers. A name that matches no family goes to NIIMBOT first, exactly as before. If it does not look like a NIIMBOT and misses the handshake twice, its services decide (`byServices`): the cat service makes it a cat printer, any other serial service outside NIIMBOT's a receipt printer, and a printer offering only NIIMBOT services keeps the NIIMBOT error. The `niimbotHandshake` option skips the NIIMBOT step for the names you choose, so their services decide at once. A type from `PRINTER_TYPES` set for unrecognised printers overrides all of this. Every family gets the same treatment:

- **Detection**: the right client and settings, picked for you.
- **Page handling**: each page is cropped to the head, rotated where the printer needs it, and encoded in the printer's own format.
- **Paper types**: gaps, black marks and continuous paper, on printers that tell them apart.
- **Density**: each printer's own darkness range, mapped from one `density` option.
- **Progress**: pages done, and how much of each page has been sent.

### NIIMBOT

Label printers in many widths, from 12 mm pocket models up. Protocol by [niimbluelib](https://github.com/MultiMote/niimbluelib), which libniimai loads only when a NIIMBOT connects. libniimai reads the loaded roll from its RFID tag (size, paper type, labels left) and the battery level, and adds fixes verified on hardware, such as the B21 C2B on early firmware. Models niimbluelib does not know yet print with a manual profile from `MANUAL_PROFILES`.

### TSPL label printers

Desktop label printers up to 80 mm wide that take TSC's TSPL label language. The printer finds each label's edge itself, and confirms each job. When a job goes unconfirmed, libniimai asks the printer why, and an open cover, jam or empty roll comes back as an error. Common 2- to 3-inch label sizes are listed in `profile.sizes`, 3 × 4 inch included. These printers cannot sense the roll, so `status.label.barcode` gives a stable key to remember its size per printer.

### ESC/POS receipt printers

Receipt printers on 58 mm paper with a 384-dot head, and 80 mm models with a 576-dot head. Pages print as one raster image at any length, for receipts, lists and long labels. On continuous paper each print ends with about 15 mm of feed, so the label clears the tear bar. `feed(mm)` lines up the paper; these printers have no reverse feed. For sticker rolls, `gapMm` keeps each print on its sticker.

### Cat printers

The small "cat" printers sold under many names, on 58 mm paper with a 384-dot head. Five darkness levels, flow control so long prints never overrun the printer, and the newer GB03 and MX-series variants handled per model. `feed(mm)` moves the paper either way to line it up, and `gapMm` keeps prints on sticker rolls.

### Marklife label printers

Marklife printers, known by Bluetooth name only: they look like NIIMBOT printers but share nothing with them inside, and the service they offer (`FF00`) is too common to tell them by. The P12, P15 and P11 print on 12 to 15 mm tape that runs sideways through a 96-dot head, like a NIIMBOT D11; the P50 prints on stickers up to 50 mm wide with a 384-dot head and a deflated raster. The printer finds each label's edge and confirms each label; an empty roll, open cover or overheating comes back as an error. Writes go in the packet size the firmware takes and follow the credits it hands out. Like TSPL printers, they cannot sense the roll, so `status.label.barcode` keys its size per printer. The P12 and P15 also connect over USB.

Each model is marked by how well it is tested in `TSPL_MODELS`, `ESCPOS_MODELS`, `CAT_MODELS` and `MARKLIFE_MODELS`; see also [thermal-printers.md](https://github.com/theanam/niimai/blob/main/docs/thermal-printers.md).

## Install

```bash
npm i libniimai
```

Ships as an ES module with TypeScript types.

## Quick start

```ts
import { createPrinter } from 'libniimai';

const printer = createPrinter();
printer.subscribe((status) => console.log(status.state, status.deviceName, status.progress));

// Connecting must start from a user gesture, such as a click.
button.onclick = async () => {
  await printer.connect('bluetooth');
  const { dpi } = printer.getStatus().profile!;

  // A 50 × 30 mm label at the printer's resolution.
  const dots = (mm: number) => Math.round((mm / 25.4) * dpi);
  const canvas = document.createElement('canvas');
  canvas.width = dots(50);
  canvas.height = dots(30);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = `bold ${dots(8)}px sans-serif`;
  ctx.fillText('Hello', dots(4), dots(18));

  await printer.print(canvas, { density: 3, copies: 1 });
};
```

Draw black on white. Thermal printers print each dot black or white, so dither photos and greys first. The same code prints on all four families; `density` is clamped to the printer's range.

Bluetooth printers with names libniimai does not know get the NIIMBOT handshake first, which receipt printers print as a line of text. If you know your printers, skip it for them:

```ts
// Printers named POS-… are receipt printers here: match them by their services at once.
const printer = createPrinter({ niimbotHandshake: (name) => !name?.startsWith('POS-') });
```

## API

### `createPrinter(options?)`

Returns a `PrinterService`, which owns one printer connection.

| Option | What it does |
| --- | --- |
| `createClient` | Makes the client for each connection. Defaults to `createClient`. |
| `niimbotHandshake` | Whether a Bluetooth printer with an unknown name gets the NIIMBOT handshake before its services decide: `true` (the default), `false`, or a function of the Bluetooth name. Receipt printers print the handshake bytes as text, so skip it for printers you know are not NIIMBOTs. Printers named like a NIIMBOT always get it; an unknown NIIMBOT that skips it and offers only NIIMBOT services cannot connect. |

| Member | What it does |
| --- | --- |
| `connect(kind)` | Opens the browser's device picker and connects. `kind` is `'bluetooth'` (every family), `'serial'` (NIIMBOT over USB, as a serial port), `'usb'` (label and receipt printers that show up as standard USB printers) or `'demo'` (a printer in memory, for trying things out). |
| `disconnect()` | Closes the connection. |
| `print(source, options)` | Prints a canvas, or a `{ count, page(i) }` source for a batch of different labels. |
| `getStatus()` | The current `PrinterStatus`. |
| `subscribe(fn)` | Calls `fn` on every status change. Returns a function that unsubscribes. |
| `feed(mm)` | Moves the paper by `mm` to line it up, back into the printer when negative. For printers that cannot sense the paper, where `status.canFeed` is true. |
| `rememberMatches(map)` | Printers matched by their services before, by Bluetooth name (`{ 'MTP-4B_6DEF': 'escpos' }`, built from `status.deviceName` and `status.matchedAs`). They connect straight to that client, without the NIIMBOT handshake a receipt printer would print as text. |
| `setNiimbotHandshake(policy)` | Sets the `niimbotHandshake` policy for the next connection. |
| `setPrintWidth(mm)` | Sets the print width on a printer whose head width is not known (`status.headUnknown`): a stock module name, or a printer matched by its services. Other printers keep their own. |
| `setManualProfile(id)` | Picks a printer type for a printer that is not recognised: a NIIMBOT model from `MANUAL_PROFILES`, or a receipt, label or cat printer from `PRINTER_TYPES`. With one of those, the Bluetooth chooser lists every device. |

**Print options**

| Option | What it does |
| --- | --- |
| `density` | Darkness, clamped to `profile.densityMin`–`densityMax`. |
| `copies` | Copies of each page. |
| `labelType` | Paper type, from `PAPER_TYPES`: 1 labels with gaps, 2 black mark, 3 continuous. |
| `offset` | Nudges the print, in mm: `{ x, y }`. |
| `gapMm` | Stickers with gaps on printers that cannot sense them (`status.canFeed`): each label is followed by exactly this much feed, in place of the tear-off feed. |
| `rotate` | Turns each page clockwise by 0, 90, 180 or 270 degrees before sending, for landscape labels. `offset` still moves the print relative to the paper. |

**`PrinterStatus`**

| Field | What it holds |
| --- | --- |
| `state` | `disconnected`, `connecting`, `ready` or `printing`. |
| `deviceName` | The printer's Bluetooth name. |
| `profile` | `dpi`, `printheadPixels`, `printDirection`, density range, `kind: 'thermal'` for continuous-paper printers, and `sizes` for printers with a size list. |
| `label` | The loaded roll, where the printer reports one. |
| `battery` | Battery level, where the printer reports one. |
| `progress` | `{ page, total, sending }`; `sending` is 0–100 for the page going over the link. |
| `canFeed` | True when `feed(mm)` can move the paper: ESC/POS and cat printers. |
| `matchedAs` | `'escpos'` or `'cat'` when the printer was matched by its services; keep it for `rememberMatches`. |
| `headUnknown` | True when the head's width is a guess (384 dots until set) and `setPrintWidth(mm)` can set it. |

### Your own clients

Pass `createClient` to change how one kind of connection is made and keep the others. This demo prints like a 58 mm ESC/POS printer into memory, while Bluetooth and USB use the built-in clients:

```ts
import { createClient, createPrinter, DEMO_NAME, EscPosPrinterClient } from 'libniimai';

const output: Uint8Array[] = [];
const printer = createPrinter({
  createClient: (kind) =>
    kind === 'demo'
      ? Promise.resolve(
          new EscPosPrinterClient(
            {
              name: DEMO_NAME,
              write: async (chunk) => void output.push(chunk.slice()),
              onNotify: () => {},
              onDisconnect: () => {},
              disconnect: async () => {},
            },
            null,
            // No Bluetooth to pace for: send at once.
            { chunkMs: 0, pauseMs: 1 },
          ),
        )
      : createClient(kind),
});
```

A printer connected as `'demo'` takes the stand-in's paper, head and density range, and always shows as `DEMO_NAME`. Thermal clients encode their own pages, so niimbluelib never loads for them.

### Lower level

Every piece is exported, for building your own flow:

- `createClient(kind)` returns a raw client for one connection.
- `TsplPrinterClient`, `EscPosPrinterClient`, `CatPrinterClient` and `MarklifePrinterClient` take any `ThermalTransport`, so they also work over other links.
- `tsplJob`, `escposJob`, `catJob`, `marklifeTapeJob` and `marklifeStickerJob` build the bytes for one page; `escposFeed` and `catFeed` the bytes that move the paper.
- `identifyPrinter(name)` matches a Bluetooth name to a known model across every family, from `PRINTER_CATALOG`; `tsplModelFor`, `escposModelFor`, `catModelFor` and `marklifeModelFor` look in one family. `identifyUsbPrinter(device)` does the same for a USB device, by vendor and product ID, then product name.
- `UsbPrinter` connects over WebUSB to a printer-class device (`USB_PRINTER_CLASS`, 7). The family comes from the catalog, then from a type set with `unrecognisedAs` when the printer speaks it, then from the printer's IEEE 1284 device ID (`familiesFromDeviceId`). A printer the site already uses connects without the chooser when it is the only one plugged in; `rememberedUsbPrinters()` lists them. `usbTransport(device)` gives the raw `ThermalTransport`.
- `supportIssue(kind)` says why a connection type cannot be used in the current browser, as `{ reason, topic }`, or null when it can. `topic` names what fixes it: `linux` (a Chrome flag), `brave` (Brave flags), `ios`, `https`, `usb` (Windows and Linux drivers holding a USB printer) or `browsers`. `unsupportedReason(kind)` returns the reason alone.
- `detectBrowser()` returns the system, the browser and whether it is built on Chromium.
- `connectErrorTopic(err)` maps a connect error from a browser that has Bluetooth or USB but cannot use it (adapter off, API turned off, a system driver holding the printer) to the same topics.

## Browsers

Needs Web Bluetooth, Web Serial or WebUSB: Chrome or Edge on desktop, or Chrome on Android. On iPhone and iPad, the Bluefy browser adds Web Bluetooth. On Linux, Chrome needs `chrome://flags/#enable-web-bluetooth` turned on; Brave keeps Bluetooth and serial behind `brave://flags`. For USB printers, Windows needs the WinUSB driver (Zadig installs it), and Linux needs the `usblp` module unloaded and a udev rule granting access.

## Feedback

Found a bug, or a printer that should work? [Open an issue](https://github.com/theanam/niimai/issues). For anything else, write to [anam.ahmed.a@gmail.com](mailto:anam.ahmed.a@gmail.com).

## Credits

- [niimbluelib](https://github.com/MultiMote/niimbluelib) by MultiMote, for the NIIMBOT protocol
- [rbaron/catprinter](https://github.com/rbaron/catprinter) and [NaitLee/Cat-Printer](https://github.com/NaitLee/Cat-Printer), for the cat printer protocol
- TSC's TSPL programming manual, for the label printer language
- [tomLadder/thermoprint](https://github.com/tomLadder/thermoprint) and [thermal-label/marklife](https://github.com/thermal-label/marklife), for the Marklife protocol notes

libniimai is an independent project and is not affiliated with NIIMBOT or any printer maker.

## License

[MIT](https://github.com/theanam/niimai/blob/main/LICENSE)
