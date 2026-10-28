import { asSvgBlob, isImageFile, isSvgFile, looksLikeSvg, svgSize } from './svg';

describe('svg import', () => {
  it('recognises SVG files by type or name', () => {
    expect(isSvgFile(new File(['<svg/>'], 'logo.svg'))).toBe(true);
    expect(isSvgFile(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).toBe(true);
    expect(isSvgFile(new File([''], 'photo.png', { type: 'image/png' }))).toBe(false);
    expect(isImageFile(new File(['<svg/>'], 'LOGO.SVG'))).toBe(true);
    expect(isImageFile(new File([''], 'notes.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('recognises pasted SVG markup', () => {
    expect(looksLikeSvg('<svg viewBox="0 0 10 10"></svg>')).toBe(true);
    expect(looksLikeSvg('<?xml version="1.0"?>\n<!-- Figma -->\n<svg xmlns="http://www.w3.org/2000/svg"/>')).toBe(true);
    expect(looksLikeSvg('Hello <svg>')).toBe(false);
  });

  it('reads proportions from width and height, then the viewBox', () => {
    expect(svgSize('<svg width="40mm" height="10mm" viewBox="0 0 4 4"/>')).toEqual({ w: 40, h: 10 });
    expect(svgSize('<svg viewBox="0 0 300 100"/>')).toEqual({ w: 300, h: 100 });
    expect(svgSize('<svg width="100%" height="100%" viewBox="0,0,20,10"/>')).toEqual({ w: 20, h: 10 });
    expect(svgSize('<svg/>')).toBeNull();
    expect(svgSize('not markup')).toBeNull();
  });

  it('types untyped SVG files so they render', () => {
    expect(asSvgBlob(new File(['<svg/>'], 'logo.svg')).type).toBe('image/svg+xml');
  });
});
