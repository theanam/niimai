# libniimai

Print to NIIMBOT label printers and other Bluetooth thermal printers from the browser. libniimai is the printer layer of [niimai](https://niimai.app), the label designer, published on its own.

- **One connect call** for NIIMBOT, TSPL label printers, ESC/POS mini printers and cat printers. The printer family is found from the device the user picks.
- **Print any canvas.** Pages are cropped to the printhead, rotated and encoded for the printer they go to.
- **Live status**: battery, the loaded roll on NIIMBOT printers, and print progress.
- **No server.** Everything runs in the page over Web Bluetooth or Web Serial.

## Install

```bash
npm i libniimai
```

## Print a label

```ts
import { createPrinter } from 'libniimai';

const printer = createPrinter();
printer.subscribe((status) => console.log(status.state, status.deviceName, status.progress));

// Must run from a user gesture, such as a click.
button.onclick = async () => {
  await printer.connect('bluetooth');

  // A 40 × 12 mm label at 203 dpi: 8 dots per mm.
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('Hello', 20, 66);

  await printer.print(canvas, { density: 3, copies: 1 });
};
```

Draw black on white at the printer's resolution, `status.profile.dpi`. Thermal printers print each dot black or white, so dither photos and greys first.

## API

### `createPrinter()`

Returns a `PrinterService`, which owns one printer connection.

| Member | What it does |
| --- | --- |
| `connect(kind)` | Opens the browser's device picker and connects. `kind` is `'bluetooth'`, `'serial'` (NIIMBOT over USB) or `'demo'` (a printer in memory). |
| `disconnect()` | Closes the connection. |
| `print(source, options)` | Prints a canvas, or a `{ count, page(i) }` source for a batch of different labels. Options: `density`, `copies`, `labelType` (paper type, see `PAPER_TYPES`) and `offset` in mm. |
| `getStatus()` | The current `PrinterStatus`. |
| `subscribe(fn)` | Calls `fn` on every status change. Returns a function that unsubscribes. |
| `setManualProfile(id)` | Picks a printer type from `MANUAL_PROFILES` for NIIMBOT models niimbluelib does not recognise yet. |

`PrinterStatus` holds `state` (`disconnected`, `connecting`, `ready` or `printing`), `deviceName`, `battery`, `profile` (dpi, printhead width, density range), `label` (the loaded roll) and `progress`.

### Lower level

The protocol pieces are exported too, for building your own flow:

- `createClient(kind)` returns a raw client for one connection.
- `TsplPrinterClient`, `EscPosPrinterClient`, `CatPrinterClient` and `ThermalPrinterClient` take any `ThermalTransport`.
- `tsplJob`, `escposJob` and `catJob` build the bytes for one page.
- `TSPL_MODELS`, `ESCPOS_MODELS` and `CAT_MODELS` list the known models, with `tsplModelFor`, `escposModelFor` and `catModelFor` to match a Bluetooth name.
- `unsupportedReason(kind)` says in a few words why a connection type cannot be used in the current browser.

## Printers

NIIMBOT printers go through [niimbluelib](https://github.com/MultiMote/niimbluelib), which loads only when one connects. The other families and their models are listed under [Supported printers](https://github.com/theanam/niimai#supported-printers), with how well each model is tested in [thermal-printers.md](https://github.com/theanam/niimai/blob/main/docs/thermal-printers.md).

## Browsers

Needs Web Bluetooth or Web Serial: Chrome or Edge on desktop, or Chrome on Android. Connecting has to start from a user gesture.

## Feedback

Found a bug or a printer that should work? [Open an issue](https://github.com/theanam/niimai/issues). For anything else, write to [anam.ahmed.a@gmail.com](mailto:anam.ahmed.a@gmail.com).

libniimai is an independent project and is not affiliated with NIIMBOT.

## License

[MIT](LICENSE)
