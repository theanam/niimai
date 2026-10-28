import { browserPrint, printMarkup } from './browserPrint';

describe('browser printing', () => {
  const doc = { widthMm: 40, heightMm: 12 };

  it('sizes pages to the label with no margin', () => {
    const { css } = printMarkup(doc, '<svg/>', 1);
    expect(css).toContain('size: 40mm 12mm');
    expect(css).toContain('margin: 0');
  });

  it('repeats the label once per copy', () => {
    const { html } = printMarkup(doc, '<svg/>', 3);
    expect(html.match(/print-page/g)).toHaveLength(3);
  });

  it('fills the print root and opens the print dialog', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    browserPrint({ ...doc } as never, '<svg id="x"/>', 2);
    expect(document.querySelectorAll('#print-root .print-page')).toHaveLength(2);
    expect(document.getElementById('print-page-style')?.textContent).toContain('40mm');
    expect(print).toHaveBeenCalled();
    window.dispatchEvent(new Event('afterprint'));
    expect(document.getElementById('print-root')?.innerHTML).toBe('');
  });
});
