import { readFileSync } from 'node:fs';

describe('index.html SEO', () => {
  const html = readFileSync('index.html', 'utf8');

  it.each([
    '<title>',
    'name="description"',
    'rel="canonical"',
    'property="og:title"',
    'property="og:description"',
    'property="og:image"',
    'property="og:url"',
    'name="twitter:card"',
    'application/ld+json',
    'name="theme-color"',
  ])('includes %s', (tag) => {
    expect(html).toContain(tag);
  });

  it('points social images at files that exist', () => {
    expect(readFileSync('public/og-image.png').length).toBeGreaterThan(1000);
    expect(readFileSync('public/logo.svg', 'utf8')).toContain('<svg');
  });
});
