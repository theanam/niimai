import { fireEvent, render, screen } from '@testing-library/react';
import { RasterImage, shrinkInk } from './RasterImage';

/** A 1-bit RGBA page, white, with the given dark pixels. */
function page(w: number, h: number, dark: [number, number][]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x, y] of dark) d.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3);
  return d;
}

/** Gives the image a natural width and a displayed width, then lets it load. */
function show(natural: number, displayed: number) {
  render(<RasterImage className="preview" src="data:image/png;base64,AA" alt="Print preview" />);
  const img = screen.getByRole('img', { name: 'Print preview' });
  Object.defineProperty(img, 'naturalWidth', { value: natural });
  img.getBoundingClientRect = () => ({ width: displayed, height: displayed }) as DOMRect;
  fireEvent.load(img);
  return img;
}

describe('raster image', () => {
  it('keeps a line one dot wide visible when shrunk four times', () => {
    const line = Array.from({ length: 8 }, (_, x) => [x, 5] as [number, number]);
    const grey = shrinkInk(page(8, 8, line), 8, 8, 2, 2);
    // The line falls in the lower row of output pixels: dark there, white above.
    expect([...grey.slice(0, 2)]).toEqual([255, 255]);
    expect(grey[2]).toBeLessThan(80);
    expect(grey[3]).toBeLessThan(80);
  });

  it('keeps hard pixel edges at full size and larger', () => {
    expect(show(384, 800)).toHaveClass('crisp');
    expect(document.querySelector('.raster.preview')).toHaveAttribute('data-mode', 'crisp');
  });

  it('falls back to the plain image where canvas is unavailable', () => {
    expect(show(384, 120)).not.toHaveClass('crisp');
    expect(document.querySelector('.raster')).toHaveAttribute('data-mode', 'plain');
  });
});
