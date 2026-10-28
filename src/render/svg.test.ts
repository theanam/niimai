import { createDoc, createElement, type TextElement } from '../doc/model';
import { ptToMm } from '../lib/units';
import { elementSvg, fitFontSize, renderSvg } from './svg';

const measure = (text: string) => text.length * 0.5;

describe('svg renderer', () => {
  const doc = createDoc({ widthMm: 40, heightMm: 12 });

  it('sizes the document in millimetres', () => {
    const svg = renderSvg(doc);
    expect(svg).toContain('width="40mm"');
    expect(svg).toContain('height="12mm"');
    expect(svg).toContain('viewBox="0 0 40 12"');
  });

  it('omits physical size for on-screen use', () => {
    expect(renderSvg(doc, { physicalSize: false })).not.toContain('width="40mm"');
  });

  it('escapes text and keeps each line', () => {
    const el = createElement('text', doc, { text: 'a<b>\n&c' } as Partial<TextElement>);
    const svg = elementSvg(el, { measure });
    expect(svg).toContain('a&lt;b&gt;');
    expect(svg).toContain('&amp;c');
    expect(svg.match(/<tspan/g)).toHaveLength(2);
  });

  it('fits text to the box width or height, whichever is tighter', () => {
    const el = { ...(createElement('text', doc) as TextElement), text: 'abcd', w: 10, h: 100 };
    expect(fitFontSize(el, measure)).toBeCloseTo(5);
    const tall = { ...el, w: 100, h: 6 };
    expect(fitFontSize(tall, measure)).toBeCloseTo(6 / 1.2);
  });

  it('uses the point size when auto-fit is off', () => {
    const el = { ...(createElement('text', doc) as TextElement), autoFit: false, fontSize: 10 };
    expect(fitFontSize(el, measure)).toBeCloseTo(ptToMm(10));
  });

  it('rotates around the element centre', () => {
    const el = { ...createElement('rect', doc), x: 0, y: 0, w: 10, h: 4, rotation: 45 };
    expect(elementSvg(el)).toContain('rotate(45 5 2)');
  });

  it('renders QR codes as nested vector symbols', () => {
    expect(elementSvg(createElement('qr', doc))).toMatch(/<svg [^>]*viewBox=/);
  });

  it('draws a placeholder for an unencodable barcode', () => {
    const el = createElement('barcode', doc, { format: 'ean13', value: 'abc' } as never);
    expect(elementSvg(el)).toContain('stroke-dasharray');
  });

  it('prefers processed images when given', () => {
    const el = createElement('image', doc, { src: 'data:image/png;base64,AAA' } as never);
    expect(elementSvg(el)).toContain('data:image/png;base64,AAA');
    expect(elementSvg(el, { images: { [el.id]: 'data:processed' } })).toContain('data:processed');
  });

  it('draws icons from their path data, filled black', () => {
    const el = createElement('icon', doc, { name: 'x', body: '<path d="M0 0H256V256Z"/>' } as never);
    expect(elementSvg(el)).toMatch(/<svg [^>]*viewBox="0 0 256 256"[^>]*fill="#000"><path d="M0 0H256V256Z"\/><\/svg>/);
    expect(elementSvg(createElement('icon', doc))).toContain('stroke-dasharray');
  });

  it('embeds extra css', () => {
    expect(renderSvg(doc, { css: '@font-face{}' })).toContain('<style>@font-face{}</style>');
  });
});
