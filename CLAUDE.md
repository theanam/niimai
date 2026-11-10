# niimai — project rules

Browser-based label designer and printer for NIIMBOT printers. See [SPEC.md](SPEC.md) for the design.

## Platform
1. Everything runs in the client browser. No backend.
2. Must run from GitHub Pages (static build, relative/`base` paths, hash routing).
19. The local dev server uses port **5197**.
20. Git remote: `git@github.com:theanam/niimai.git`.
22. Printer connection and protocol code lives in `packages/libniimai` (published to npm as `libniimai`). It must never import from `src/`; anything the app needs from it goes through its `index.ts` exports.
23. Every change to `packages/libniimai` bumps its `version` in the same commit (patch for fixes, minor for new features or printers, and while it is 0.x, minor for breaking changes too). After pushing to `main`, tag that commit `libniimai-v<version>` and push the tag; the tag publishes it to npm.
25. Printer families stay apart, and features are only ever added. Each family's code (`escpos.ts`, `cat.ts`, `tspl.ts`, `marklife.ts`) imports only the shared thermal base; the NIIMBOT path and the shared service import no other family; families meet only in `bluetooth.ts` and `catalog.ts`. `boundary.test.ts` enforces this. NIIMBOT printers must keep working out of the box with the exact print task they always got, and shipped model names never change (their saved settings are keyed by them); tests pin both. New detection must never take a printer from the client it worked with before.

## Git
3. Commit author email: `anam.ahmed.a@gmail.com` (set in the repo's local git config).
8. Write tests for every feature. Commit only when asked, and only after `npm test` passes.

## Content
4. The app has a Help page and an About page. Issues link to the GitHub issue tracker; everything else goes to `anam.ahmed.a@gmail.com`.
5. A GitHub logo in the app links to the repository.
6. The README shows the logo and a screenshot and is written for visitors. No diary or todo lists.
7. Update the README screenshot (`npm run screenshot`) after any noticeable UI change.
10. Keep OG and SEO tags in `index.html` complete and accurate.
13. Avoid "this, not that" phrasing in any text.

## UI
9. Use error boundaries so a failure in one panel never breaks the whole app.
11. Keep text short. Use icons wherever icons are the norm.
12. Never use system dialogs (`alert`, `confirm`, `prompt`). Use the Radix dialog components in `src/ui/`.
14. Peacock (VS Code) color is set to the primary color in `.vscode/settings.json` and committed.
24. **Hard rule:** a UI check passes only if the UI and layout are not broken. Look at every changed screen and state at full size (no stale or mid-animation screenshots): alignment, spacing, consistent grids, nothing half-width or cramped. Fix any flaw before calling the work done.

## When applicable
15. Font picker: all Google Fonts, grouped by category, with live previews (modelled on theanam/pinwheel-studio).
16. Capture standard shortcuts (Cmd/Ctrl+N new, +O open, +S save, +Shift+S save as, +P print, +Z/Shift+Z undo/redo, etc.) and map them to app actions.
17. Open/save files with the File System Access API first, falling back to `<input type="file">` and downloads (modelled on theanam/betterScad).
18. Browser printing outputs the label as a real document: vector SVG at the exact label size via `@page`.

## Tour
21. First-time visitors get a skippable, visual tour (`src/tour/`), shown once (flag in `localStorage`). When a notable feature ships, add it to `TOUR_STEPS` as a step or a highlight. Bump `TOUR_KEY` when the additions are worth showing to people who already saw it.
