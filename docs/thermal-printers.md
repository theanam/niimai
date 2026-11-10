# Other Bluetooth thermal printers

niimai is made for NIIMBOT printers. As an extra, it also prints on TSPL
label printers up to 80 mm wide, on Marklife label printers, on ESC/POS receipt printers (58 mm, and 80 mm
models listed below), and on cat printers. Unless a model says otherwise, a
receipt or cat printer has a 48 mm print width: a 384-dot head at 203 dpi.

| Type | Paper | Print width | Service |
|---|---|---|---|
| TSPL label printers | Labels with gaps, black mark or continuous | Up to 80 mm | `18F0` |
| ESC/POS receipt printers | 58 or 80 mm, continuous or stickers | 48 or 72 mm | `18F0`, `E781` or another serial service |
| Cat printers | 58 mm, continuous or stickers | 48 mm | `AE30` |
| Marklife label printers | 12–15 mm tape, or stickers up to 50 mm | 12 or 48 mm | `FF00` |

Connect them the same way as a NIIMBOT printer: **Connect → Bluetooth**, then
pick the printer in the browser's list. niimai recognises the model by its
Bluetooth name and checks that it offers the expected service before printing.

Most of these printers share one Bluetooth module, which offers the same
services whatever the printer speaks (`18F0`, `FF00`, `FEE7`, `E781`,
`49535343`), so the name is the only reliable sign of the family. A name niimai
does not know is treated as a NIIMBOT. If such a printer does not connect,
choose **Receipt printer**, **Label printer** or **Cat printer** under
**Advanced** in the printer window and connect again: Bluetooth then lists
every nearby device.

Confidence levels:

- **Tested**: printed with niimai on real hardware.
- **High**: widely used and supported by the reference projects below.
- **Medium**: reported to use the same protocol, with fewer reports.

## TSPL label printers

Desktop label printers that take TSC's TSPL label language over the `18F0`
printer service. niimai treats them as label printers: pick the roll size and
paper type as usual, and the printer finds the edge of each label itself. The
head is 80 mm (640 dots) at 203 dpi; labels print from its left edge.

| Model | Confidence | Notes |
|---|---|---|
| QR380A | Tested | Sold as CC390 |
| GP-M322 | Medium | Gprinter GP-M322, 72 mm head |

Darkness runs from 1 to 15. If labels come out blank, check that the roll's
printable side faces the print head.

## ESC/POS receipt printers

Receipt printers that take standard ESC/POS raster images. Paper narrower than
the head can be set in the printer window; labels then print centred.

| Bluetooth name | Confidence | Notes |
|---|---|---|
| MP583 | Tested | Sold as YAEN MPT-II |
| MTP-4B | Tested | Paper up to 75 mm, 72 mm print width |
| Printer… | Tested | Stock module name: Xprinter XP-58IIL (tested), HOIN, Gprinter |
| MPT-II, MTP-II | High | Stock module names on many 58 mm printers |
| PT-210, PT210, GOJRPT, Gojprt | High | Goojprt PT-210 |
| RPP02 | High | Rongta RPP02N, also sold as EPPOS EP58 Plus |
| MP58, MP210, MTP-2, PT-200 | Medium | 58 mm |
| MPT-3, MTP-3 | Medium | 80 mm, 72 mm print width |
| RPP300 | Medium | Rongta RPP300, 80 mm |
| XP-P323B | Medium | Xprinter XP-P323B, 80 mm |
| XP- | Medium | Other Xprinter models, 58 mm unless set |
| ZJ-58 | Medium | Zjiang |
| TM-P | Medium | Epson TM-P series |
| BlueTooth Printer, 58Printer | Medium | Stock module names |

Feeding uses line feeds (`ESC 3 n`, `LF`): the MP583 ignores `ESC J`. These
printers have no reverse feed.

Darkness is set on the printer itself, so niimai shows no density slider for
these.

## Cat printers

Printers often called "cat printers", using the `AE30` service.

| Model | Confidence | Notes |
|---|---|---|
| GB01 | High | |
| GB02 | High | |
| GB03 | High | Uses the newer start command |
| MX05 | High | Paper is fed with blank rows |
| MX06 | High | Paper is fed with blank rows |
| MX10 | High | Paper is fed with blank rows |
| MX08 | Medium | Paper is fed with blank rows |
| MX09 | Medium | Paper is fed with blank rows |
| MX11 | Medium | |
| GT01 | Medium | |
| YT01 | Medium | |
| PD01 | Medium | |
| MXTP | Medium | |
| SC03h | Medium | |

## Marklife label printers

Marklife printers (made by FeiOou/Deli) look like NIIMBOT printers but use
their own protocols, over the `FF00` service. niimai knows them by Bluetooth
name only, so a NIIMBOT is never taken for one. Like TSPL printers, they find
each label's edge but not its size: tap the sticker size on the start screen to
set it, and save it as a paper.

| Model | Confidence | Notes |
|---|---|---|
| P12 | High | 12–15 mm tape, 96-dot head. Also over USB |
| P15 | High | 12–15 mm tape, 96-dot head. Also P15R and P15S, and over USB |
| P11 | Medium | 12–15 mm tape |
| P50 | Medium | Stickers up to 50 mm, 384-dot head. Also P50S |

The P12, P15 and P11 take the L11 protocol: the tape runs sideways through
the head, as on a NIIMBOT D11, and darkness runs from 1 to 3. The P50 takes
the YXQ protocol with a deflated raster, and darkness from 1 to 15. Marklife
names that NIIMBOT also uses (A1, P1S, T2) are left out, as are the models
on other protocols (D100, X4, T3).

## Not supported

These look similar but use other protocols.

| Model | Why |
|---|---|
| MXW01 | Newer protocol |
| PeriPage | Different protocol |
| Phomemo M02 / T02 | Different protocol |

If your model works and is not listed, or a listed model misbehaves, please
[open an issue](https://github.com/theanam/niimai/issues) with its Bluetooth
name.

## Sources

- [rbaron/catprinter](https://github.com/rbaron/catprinter) and
  [NaitLee/Cat-Printer](https://github.com/NaitLee/Cat-Printer), for the cat
  printer protocol
- The ESC/POS command reference, for raster images (`GS v 0`)
- [tomLadder/thermoprint](https://github.com/tomLadder/thermoprint),
  [thermal-label/marklife](https://github.com/thermal-label/marklife) and
  Marklife's web kit, for the Marklife protocols
- TSC's TSPL programming manual, for label printers (`SIZE`, `GAP`, `BITMAP`)
- Bluetooth names and services of receipt printers, from
  [NielsLeenheer/WebBluetoothReceiptPrinter](https://github.com/NielsLeenheer/WebBluetoothReceiptPrinter),
  [bitbank2/Thermal_Printer](https://github.com/bitbank2/Thermal_Printer),
  [bitbank2/Print2BLE](https://github.com/bitbank2/Print2BLE) and
  [ReceiptPrinterEncoder](https://github.com/at-point-of-sale/ReceiptPrinterEncoder)
