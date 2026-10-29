# Other Bluetooth thermal printers

niimai is made for NIIMBOT printers. As an extra, it also prints on the small
Bluetooth thermal printers often called "cat printers": 57 mm continuous paper,
a 48 mm print width and a 384-dot head at 203 dpi.

Connect them the same way as a NIIMBOT printer: **Connect → Bluetooth**, then
pick the printer in the browser's list. niimai recognises the model by its
Bluetooth name and checks that it offers the `AE30` service before printing.

## Known models

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

- **Tested**: printed with niimai on real hardware.
- **High**: supported by both reference projects below and widely used.
- **Medium**: listed by Cat-Printer, with fewer reports.

### Not supported

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

The protocol comes from these open-source projects:

- [rbaron/catprinter](https://github.com/rbaron/catprinter)
- [NaitLee/Cat-Printer](https://github.com/NaitLee/Cat-Printer)
