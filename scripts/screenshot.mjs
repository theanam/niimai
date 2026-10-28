// Captures the README screenshot, the social preview image and the touch icon.
//   npm run screenshot
// Starts the dev server on port 5197 when it is not already running, and uses
// the locally installed Chrome through playwright-core.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const URL = 'http://localhost:5197/';
const root = new globalThis.URL('..', import.meta.url).pathname;

async function ensureServer() {
  try {
    await fetch(URL);
    return null;
  } catch {
    const server = await createServer({ root, server: { port: 5197, strictPort: true } });
    await server.listen();
    return server;
  }
}

const id = () => Math.random().toString(36).slice(2);
const now = Date.now();
const demo = {
  version: 1,
  id: 'readme-demo',
  name: 'Pantry',
  widthMm: 50,
  heightMm: 30,
  createdAt: now,
  updatedAt: now,
  elements: [
    { id: id(), type: 'frame', x: 0.5, y: 0.5, w: 49, h: 29, rotation: 0, style: 'double', strokeWidth: 0.3 },
    { id: 'title', type: 'text', x: 3.5, y: 3, w: 27, h: 11, rotation: 0, text: 'Smoked\nPaprika', fontFamily: 'Fraunces', fontSize: 12, bold: true, italic: false, align: 'left', autoFit: true },
    { id: id(), type: 'line', x: 3.5, y: 15.5, w: 27, h: 1, rotation: 0, strokeWidth: 0.4, direction: 'horizontal' },
    { id: id(), type: 'text', x: 3.5, y: 17.5, w: 27, h: 3.5, rotation: 0, text: 'Best before 04 / 2027', fontFamily: 'Space Grotesk', fontSize: 8, bold: false, italic: false, align: 'left', autoFit: true },
    { id: id(), type: 'barcode', x: 3.5, y: 22, w: 27, h: 5.5, rotation: 0, value: 'PAP-0427', format: 'code128', showText: false },
    { id: id(), type: 'qr', x: 33, y: 7, w: 14, h: 14, rotation: 0, value: 'https://niimai.app/' },
    { id: id(), type: 'text', x: 33, y: 22, w: 14, h: 4, rotation: 0, text: 'SHELF 3', fontFamily: 'Space Grotesk', fontSize: 8, bold: true, italic: false, align: 'center', autoFit: true },
  ],
};

async function seed(page) {
  // The first-run tour would cover every shot.
  await page.addInitScript(() => localStorage.setItem('niimai.tour.v1', 'done'));
  await page.goto(URL);
  await page.waitForSelector('.start');
  await page.evaluate(async (doc) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('niimai', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['labels', 'settings'], 'readwrite');
      tx.objectStore('labels').put(doc);
      tx.objectStore('settings').put(doc.id, 'lastLabelId');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, demo);
  await page.reload();
  await page.waitForSelector('.start-recent');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
}

async function openEditor(page) {
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.waitForSelector('.canvas-svg');
  await page.waitForTimeout(500);
}

const server = await ensureServer();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await context.newPage();
  await seed(page);
  await page.screenshot({ path: `${root}docs/start.png` });
  await openEditor(page);
  await page.click('.canvas-el[data-id="title"]');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${root}docs/screenshot.png` });

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+l' : 'Control+l');
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('list', { name: 'Templates' }).waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${root}docs/templates.png` });
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1200, height: 630 });
  const og = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' });
  const ogPage = await og.newPage();
  await seed(ogPage);
  await openEditor(ogPage);
  await ogPage.screenshot({ path: `${root}public/og-image.png` });

  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  const logo = readFileSync(`${root}public/logo.svg`, 'utf8');
  await icon.setContent(`<body style="margin:0;background:#fff;display:grid;place-items:center;height:180px">${logo.replace('<svg ', '<svg width="140" height="140" ')}</body>`);
  await icon.screenshot({ path: `${root}public/apple-touch-icon.png` });
  console.log('Wrote docs/start.png, docs/screenshot.png, docs/templates.png, public/og-image.png, public/apple-touch-icon.png');
} finally {
  await browser.close();
  await server?.close();
}
