# Label Studio for NIIMBOT — Basic Spec

A clean, fast, browser-based label designer and printer for NIIMBOT thermal printers.
Builds on `niimbluelib` for the printer protocol and replaces the UI with something pleasant to use.

> This is a starting sketch. Rules and details get added as the project evolves.

---

## 1. Goals

- **Open a page, connect, and print in under 30 seconds.** No account, no install, no ads.
- **A good editor:** direct manipulation, snapping, a preview of exactly what will print.
- **Supports several models:** works with the D21 first, then the other machines on hand, with model quirks kept in one place.
- **Local-first:** everything is stored in the browser. Works offline once loaded (PWA).

### Non-goals (for now)
- Cloud sync or accounts
- A native mobile app (iOS Safari has no Web Bluetooth)
- Reimplementing the protocol (use `niimbluelib`; fix things upstream where possible)

---

## 2. Platform constraints

- **Web Bluetooth and Web Serial only work in Chromium browsers:** Chrome and Edge on desktop, and Chrome on Android. Firefox and Safari aren't supported, so show a clear message instead of a broken UI.
- Requires HTTPS (or `localhost` during development).
- A Bluetooth connection has to be started by a user gesture (clicking a button).

---

## 3. Tech stack (proposed)

- **TypeScript + Vite**
- **UI framework:** Svelte or React (pick one and stick with it)
- **Protocol:** `niimbluelib` (check its license and whether it supports the D21)
- **Canvas/editor:** Konva or Fabric.js, or a hand-rolled canvas
- **Barcodes/QR:** `bwip-js` or `qrcode`
- **Storage:** IndexedDB (through `idb` or Dexie)
- **Styling:** Tailwind or plain CSS with design tokens. Light and dark themes.

---

## 4. Architecture

```
┌─────────────────────────────────────────────┐
│ UI (editor, panels, dialogs)                │
├──────────────┬──────────────┬───────────────┤
│ Document     │ Renderer     │ Storage       │
│ model (JSON) │ doc → 1-bit  │ IndexedDB     │
├──────────────┴──────┬───────┴───────────────┤
│ Printer service (one interface)             │
├─────────────────────┴───────────────────────┤
│ niimbluelib  +  model profiles (quirks)     │
└─────────────────────────────────────────────┘
```

### 4.1 Printer service
- One interface the UI talks to: `connect()`, `disconnect()`, `getStatus()`, `print(bitmap, options)`, plus events (`connected`, `status`, `progress`, `error`).
- Wraps `niimbluelib`. The UI never touches raw packets.
- **Model profiles** (`profiles/d21.ts`, etc.): DPI, printhead width, density range, default rotation, supported label sizes, protocol variant, known quirks.
- Reads battery level, connection state and RFID label info (size and remaining count) when available.

### 4.2 Document model
- Label = `{ id, name, size: {wMm, hMm}, orientation, elements[], createdAt, updatedAt }`
- Element types (MVP): `text`, `image`, `qr`, `barcode`, `rect`, `line`
- Each element: position, size and rotation in **millimetres**, plus properties for its type.
- Serialisable JSON, used for saving, undo/redo and import/export.

### 4.3 Renderer
- Turns a document into a 1-bit bitmap at the printer's DPI (mm → px using the profile's DPI).
- Lets you choose how to convert images to 1-bit: threshold, or Floyd–Steinberg / Atkinson dithering.
- The **same renderer** draws the on-screen "print preview" mode, so what you see is what prints.
- Handles the model's rotation and offset before the bitmap reaches the printer service.

### 4.4 Storage
- IndexedDB: saved labels, recent label sizes, user templates, settings.
- Import/export of labels as `.json` files.

---

## 5. MVP features

1. **Connect panel:** a "Connect printer" button (Bluetooth, plus serial where it's supported), which then shows the model, battery level and detected label size.
2. **Label setup:** pick the size from the RFID reading, from presets, or enter a custom size.
3. **Editor:**
   - Add, select, move, resize and rotate elements
   - Snap to the edges and centre, arrow keys to nudge
   - Undo/redo, copy/paste, delete
   - Text: font, size, bold, alignment, auto-fit to the box
   - Image: upload or paste, with threshold or dither controls
   - QR code and common barcodes (Code128, EAN-13)
4. **Preview:** a toggle that shows the exact 1-bit output.
5. **Print:** density and number of copies, a progress indicator, and readable errors ("Lid open", "No labels", "Disconnected").
6. **Library:** save, open, duplicate and delete labels.

## 6. Later
- Variables and batch printing from CSV or a pasted list (e.g. serial numbers, names)
- Date/time and counter fields
- A template gallery
- Print history / reprint
- PWA install and offline use
- Share a label as a URL or file

---

## 7. UX principles

- One screen: the canvas in the centre, the selected element's properties on the right, the printer status in the header.
- Keyboard-friendly, with no modal dialogs for common actions.
- Always show the printer state (disconnected / ready / printing / error).
- Fast: no spinners for local actions.

---

## 8. Testing

- **Hardware:** D21 first. Keep a checklist of which models have been verified and for which features.
- Unit tests for the renderer (mm → px, rotation, dithering) using snapshot bitmaps.
- A **mock printer** implementation of the printer service, so the UI can be developed and tested without hardware.
- Log raw packets in a debug mode, so new models can be compared with captures from the official app.

---

## 9. Decisions

- **UI framework:** React 19 with Vite, Radix dialogs and popovers, lucide icons.
- **Protocol:** `@mmote/niimbluelib` from npm, loaded only on first connect.
- **Rendering:** one SVG renderer for the editor, browser printing (vector) and the thermal raster (SVG → canvas → 1-bit).
- **D21:** niimbluelib has no D21 entry. Manual printer profiles cover unknown models; the "D21" on hand reports itself as a B21 C2B (model id 771) and advertises BLE service `0000e0ff-3c17-d293-8e48-14fe2e4da212` (channel `ffe1`), which niimbluelib does not request.

### Hardware notes (B21 C2B, verified on device)
- Reports model id 771, protocol version 0, BLE service `0000e0ff-3c17-d293-8e48-14fe2e4da212`, channel `ffe1`.
- Paper info (`0x59`) is unsupported, so the roll size comes from the user, remembered by RFID barcode.
- niimbluelib's B1 task prints blank on this firmware; B21_V1 prints correctly.
- B21_V1's "print end" polling in niimbluelib stops after one reply, so the app polls it itself.
- The heartbeat pauses during printing, as NiimBlue does.

### Hardware notes (D110, verified on device)
- Model id 2304, protocol 2, standard NIIMBOT BLE service.
- Paper info (`0x59`) is also unsupported here, so roll sizes come from `src/printer/known-rolls.json` (by RFID barcode) or from the user, once per roll.

### Hardware notes (D11, verified on device)
- Model id 512; prints with the library's D110 task on protocol 1. Paper info is unsupported too.
- T12.5×74+35 cable rolls (barcode 6972842743817) are 109 × 12.5 mm: a 74 mm flag at the start of the canvas and a 35 mm tail after it. A test print confirmed the flag position; roughly the first 4 mm of the tail does not take print.
- The flag folds at its middle (37 + 37 mm). Labels carry a fold mode: `copy` repeats the first half on the second, `flip` repeats it upside down, `none` leaves both halves free.

## 10. Open questions

- Does the RFID paper size come back in millimetres on every model?
