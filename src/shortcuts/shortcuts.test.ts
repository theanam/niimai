import { matchShortcut, shortcutLabel } from './shortcuts';

const key = (k: string, mods: Partial<KeyboardEvent> = {}, target: EventTarget | null = document.body) =>
  ({ key: k, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target, ...mods }) as KeyboardEvent;

describe('shortcuts', () => {
  it('maps Cmd shortcuts on macOS', () => {
    expect(matchShortcut(key('n', { metaKey: true }), true)?.action).toBe('new');
    expect(matchShortcut(key('s', { metaKey: true }), true)?.action).toBe('save');
    expect(matchShortcut(key('S', { metaKey: true, shiftKey: true }), true)?.action).toBe('saveAs');
    expect(matchShortcut(key('z', { metaKey: true, shiftKey: true }), true)?.action).toBe('redo');
    expect(matchShortcut(key('n', { ctrlKey: true }), true)).toBeNull();
  });

  it('maps Ctrl shortcuts elsewhere, including Ctrl+Y for redo', () => {
    expect(matchShortcut(key('o', { ctrlKey: true }), false)?.action).toBe('open');
    expect(matchShortcut(key('p', { ctrlKey: true }), false)?.action).toBe('print');
    expect(matchShortcut(key('y', { ctrlKey: true }), false)?.action).toBe('redo');
  });

  it('keeps native editing shortcuts inside text fields', () => {
    const input = document.createElement('input');
    expect(matchShortcut(key('z', { metaKey: true }, input), true)).toBeNull();
    expect(matchShortcut(key('Backspace', {}, input), true)).toBeNull();
    expect(matchShortcut(key('s', { metaKey: true }, input), true)?.action).toBe('save');
  });

  it('nudges with arrows, further with shift', () => {
    expect(matchShortcut(key('ArrowLeft'), true)).toEqual({ action: 'nudge', dx: -0.1, dy: 0 });
    expect(matchShortcut(key('ArrowDown', { shiftKey: true }), true)).toEqual({ action: 'nudge', dx: 0, dy: 1 });
  });

  it('deletes and deselects', () => {
    expect(matchShortcut(key('Delete'), true)?.action).toBe('delete');
    expect(matchShortcut(key('Escape'), true)?.action).toBe('deselect');
    expect(matchShortcut(key('Enter'), true)?.action).toBe('edit');
    expect(matchShortcut(key('Enter', {}, document.createElement('textarea')), true)).toBeNull();
  });

  it('formats labels per platform', () => {
    expect(shortcutLabel('Mod+Shift+S', true)).toBe('⌘⇧S');
    expect(shortcutLabel('Mod+Shift+S', false)).toBe('Ctrl+Shift+S');
  });
});
