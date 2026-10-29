# Other Bluetooth thermal printers

niimai is made for NIIMBOT printers. As an extra, it also prints on small
Bluetooth thermal printers that use 58 mm continuous paper with a 48 mm print
width and a 384-dot head at 203 dpi.

Connect them the same way as a NIIMBOT printer: **Connect → Bluetooth**, then
pick the printer in the browser's list. niimai recognises the model by its
Bluetooth name and checks that it offers the expected service before printing.

Confidence levels:

- **Tested**: printed with niimai on real hardware.
- **High**: widely used and supported by the reference projects below.
- **Medium**: reported to use the same protocol, with fewer reports.

## ESC/POS mini printers

58 mm receipt-style printers that take standard ESC/POS raster images over the
`18F0` printer service.

| Model | Confidence | Notes |
|---|---|---|
| MP583 | Tested | Sold as YAEN MPT-II |
| MPT-II | High | |
| MP58 | Medium | |
| MTP-II | Medium | |
| PT-210 | Medium | |
| PT-200 | Medium | |
| RPP02 | Medium | |
| ZJ-58 | Medium | |

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
