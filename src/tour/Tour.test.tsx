import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { parseIconMeta } from '../icons/catalog';
import { TOUR_STEPS } from './steps';
import { replayTour, Tour, TOUR_KEY } from './Tour';

vi.mock('../render/fonts', () => ({ linkFont: async () => {}, ensureFont: async () => {} }));
vi.mock('../icons/catalog', async (orig) => ({ ...(await orig<typeof import('../icons/catalog')>()), loadIconShapes: async () => ({}) }));

beforeEach(() => localStorage.clear());

describe('first-run tour', () => {
  it('shows on the first visit and walks through every step', async () => {
    render(<Tour />);
    expect(screen.getByRole('dialog', { name: TOUR_STEPS[0].title })).toBeInTheDocument();
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByRole('heading', { name: TOUR_STEPS[i].title })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: "Let's go" }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(TOUR_KEY)).toBe('done');
  });

  it('can be skipped, and stays away after that', async () => {
    const { unmount } = render(<Tour />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(TOUR_KEY)).toBe('done');
    unmount();
    render(<Tour />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves with the arrow keys and the step dots', async () => {
    render(<Tour />);
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('heading', { name: TOUR_STEPS[1].title })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('heading', { name: TOUR_STEPS[0].title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: new RegExp(`Step ${TOUR_STEPS.length}:`) }));
    expect(screen.getByRole('heading', { name: TOUR_STEPS.at(-1)!.title })).toBeInTheDocument();
  });

  it('replays on request', () => {
    localStorage.setItem(TOUR_KEY, 'done');
    render(<Tour />);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => replayTour());
    expect(screen.getByRole('dialog', { name: TOUR_STEPS[0].title })).toBeInTheDocument();
  });

  it('still works when storage is blocked', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<Tour />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    get.mockRestore();
    set.mockRestore();
  });
});

describe('tour content', () => {
  const copy = TOUR_STEPS.map((s) => [s.title, s.body, ...s.highlights].join(' ')).join(' ').toLowerCase();

  it('covers every notable feature', () => {
    for (const feature of ['bluetooth', 'usb', 'template', 'icon', 'google font', 'qr', 'barcode', 'dither', 'preview', 'shortcut', 'roll', 'library', 'print', 'double-click']) {
      expect(copy, feature).toContain(feature);
    }
  });

  it('gives every step a title, a body and a visual', () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.body.length).toBeGreaterThan(20);
      expect(typeof s.Visual).toBe('function');
    }
  });

  it('only shows icons that exist', () => {
    const names = new Set(parseIconMeta(JSON.parse(readFileSync('public/icons/meta.json', 'utf8'))).icons.map((i) => i.name));
    const src = readFileSync('src/tour/visuals.tsx', 'utf8');
    const list = /SHOWCASE_ICONS = \[([^\]]+)\]/.exec(src)![1].match(/'([^']+)'/g)!.map((s) => s.slice(1, -1));
    for (const n of list) expect(names.has(n), n).toBe(true);
  });
});
