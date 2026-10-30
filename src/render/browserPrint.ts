import type { LabelDoc } from '../doc/model';

const ROOT_ID = 'print-root';
const STYLE_ID = 'print-page-style';

/** The markup and @page rule that print one label per page at its exact size: each SVG, copies times. */
export function printMarkup(doc: Pick<LabelDoc, 'widthMm' | 'heightMm'>, svg: string | string[], copies: number) {
  const pages = (Array.isArray(svg) ? svg : [svg]).map((one) => `<div class="print-page">${one}</div>`);
  return {
    html: pages.map((page) => Array.from({ length: Math.max(1, copies) }, () => page).join('')).join(''),
    css: `@page { size: ${doc.widthMm}mm ${doc.heightMm}mm; margin: 0; }
@media print { .print-page { width: ${doc.widthMm}mm; height: ${doc.heightMm}mm; } }`,
  };
}

/**
 * Prints through the browser as a vector document: the label SVG, fonts
 * inlined, placed on pages the size of the label.
 */
export function browserPrint(doc: LabelDoc, svg: string | string[], copies = 1): void {
  const { html, css } = printMarkup(doc, svg, copies);
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);
  }
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  root.innerHTML = html;
  style.textContent = css;
  const cleanup = () => {
    root!.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
