# libniimai

Print from the browser on four families of thermal printers: **NIIMBOT**, **TSPL label printers**, **ESC/POS mini printers** and **cat printers**. One API connects, detects the printer and prints any canvas, over Web Bluetooth or Web Serial. No server, no drivers, no app.

libniimai powers [niimai](https://niimai.app), the label designer.

## Supported printers

| Family | Paper | Print width | Connection | Models |
|---|---|---|---|---|
| **NIIMBOT** | Labels with gaps, black mark, continuous, transparent | 12 mm and up, by model | Bluetooth, USB | D11, D110, D101, B1, B18, B21, B3S and more |
| **TSPL label printers** | Labels with gaps, black mark, continuous | Up to 80 mm | Bluetooth | QR380A (sold as CC390) |
| **ESC/POS mini printers** | 58 mm continuous | 48 mm | Bluetooth | MP583, MPT-II, PT-210, RPP02, ZJ-58 and more |
| **Cat printers** | 58 mm continuous | 48 mm | Bluetooth | GB01, GB02, GB03, MX05, MX06, MX10 and more |

The family is found from the device the user picks: by its Bluetooth name, then checked against the services it offers. Every family gets the same treatment:

- **Detection**: the right client and settings, picked for you.
- **Page handling**: each page is cropped to the head, rotated where the printer needs it, and encoded in the printer's own format.
- **Paper types**: gaps, black marks and continuous paper, on printers that tell them apart.
- **Density**: each printer's own darkness range, mapped from one `density` option.
- **Progress**: pages done, and how much of each page has been sent.

### NIIMBOT

Label printers in many widths, from 12 mm pocket models up. Protocol by [niimbluelib](https://github.com/MultiMote/niimbluelib), which libniimai loads only when a NIIMBOT connects. libniimai reads the loaded roll from its RFID tag (size, paper type, labels left) and the battery level, and adds fixes verified on hardware, such as the B21 C2B on early firmware. Models niimbluelib does not know yet print with a manual profile from `MANUAL_PROFILES`.

### TSPL label printers

Desktop label printers up to 80 mm wide that take TSC's TSPL label language. The printer finds each label's edge itself, and confirms each job. When a job goes unconfirmed, libniimai asks the printer why, and an open cover, jam or empty roll comes back as an error. Common 2- to 3-inch label sizes are listed in `profile.sizes`, 3 × 4 inch included. These printers cannot sense the roll, so `status.label.barcode` gives a stable key to remember its size per printer.

### ESC/POS mini printers

Pocket receipt printers on 58 mm paper with a 384-dot head. Pages print as one raster image at any length, for receipts, lists and long labels.

### Cat printers

The small "cat" printers sold under many names, on 58 mm paper with a 384-dot head. Five darkness levels, flow control so long prints never overrun the printer, and the newer GB03 and MX-series variants handled per model.

Each model is marked by how well it is tested in `TSPL_MODELS`, `ESCPOS_MODELS` and `CAT_MODELS`; see also [thermal-printers.md](https://github.com/theanam/niimai/blob/main/docs/thermal-printers.md).

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

## API

### `createPrinter()`

Returns a `PrinterService`, which owns one printer connection.

| Member | What it does |
| --- | --- |
| `connect(kind)` | Opens the browser's device picker and connects. `kind` is `'bluetooth'` (every family), `'serial'` (NIIMBOT over USB) or `'demo'` (a printer in memory, for trying things out). |
| `disconnect()` | Closes the connection. |
| `print(source, options)` | Prints a canvas, or a `{ count, page(i) }` source for a batch of different labels. |
| `getStatus()` | The current `PrinterStatus`. |
| `subscribe(fn)` | Calls `fn` on every status change. Returns a function that unsubscribes. |
| `setManualProfile(id)` | Picks a printer type from `MANUAL_PROFILES` for NIIMBOT models niimbluelib does not know yet. |

**Print options**

| Option | What it does |
| --- | --- |
| `density` | Darkness, clamped to `profile.densityMin`–`densityMax`. |
| `copies` | Copies of each page. |
| `labelType` | Paper type, from `PAPER_TYPES`: 1 labels with gaps, 2 black mark, 3 continuous. |
| `offset` | Nudges the print, in mm: `{ x, y }`. |

**`PrinterStatus`**

| Field | What it holds |
| --- | --- |
| `state` | `disconnected`, `connecting`, `ready` or `printing`. |
| `deviceName` | The printer's Bluetooth name. |
| `profile` | `dpi`, `printheadPixels`, `printDirection`, density range, `kind: 'thermal'` for continuous-paper printers, and `sizes` for printers with a size list. |
| `label` | The loaded roll, where the printer reports one. |
| `battery` | Battery level, where the printer reports one. |
| `progress` | `{ page, total, sending }`; `sending` is 0–100 for the page going over the link. |

### Lower level

Every piece is exported, for building your own flow:

- `createClient(kind)` returns a raw client for one connection.
- `TsplPrinterClient`, `EscPosPrinterClient` and `CatPrinterClient` take any `ThermalTransport`, so they also work over other links.
- `tsplJob`, `escposJob` and `catJob` build the bytes for one page.
- `tsplModelFor`, `escposModelFor` and `catModelFor` match a Bluetooth name to a known model.
- `unsupportedReason(kind)` says in a few words why a connection type cannot be used in the current browser.

## Browsers

Needs Web Bluetooth or Web Serial: Chrome or Edge on desktop, or Chrome on Android. On iPhone and iPad, the Bluefy browser adds Web Bluetooth.

## Feedback

Found a bug, or a printer that should work? [Open an issue](https://github.com/theanam/niimai/issues). For anything else, write to [anam.ahmed.a@gmail.com](mailto:anam.ahmed.a@gmail.com).

## Credits

- [niimbluelib](https://github.com/MultiMote/niimbluelib) by MultiMote, for the NIIMBOT protocol
- [rbaron/catprinter](https://github.com/rbaron/catprinter) and [NaitLee/Cat-Printer](https://github.com/NaitLee/Cat-Printer), for the cat printer protocol
- TSC's TSPL programming manual, for the label printer language

libniimai is an independent project and is not affiliated with NIIMBOT or any printer maker.

## License

[MIT](https://github.com/theanam/niimai/blob/main/LICENSE)
