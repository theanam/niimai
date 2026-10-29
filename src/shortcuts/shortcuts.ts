export type ShortcutAction =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'print'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'delete'
  | 'deselect'
  | 'edit'
  | 'library'
  | 'preview'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomFit'
  | 'nudge';

export interface Shortcut {
  action: ShortcutAction;
  /** For nudges: millimetres to move along each axis. */
  dx?: number;
  dy?: number;
}

export const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'target'>;

/**
 * Maps a key event to an app action. Mod is Cmd on macOS and Ctrl elsewhere.
 * Plain keys (Delete, arrows) are ignored while typing in a field, as are the
 * clipboard and undo shortcuts, so text inputs keep their native behaviour.
 */
export function matchShortcut(e: KeyLike, mac = isMac()): Shortcut | null {
  const mod = mac ? e.metaKey : e.ctrlKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const typing = isTyping(e.target);

  if (mod && !e.altKey) {
    switch (key) {
      case 'n':
        return { action: 'new' };
      case 'o':
        return { action: 'open' };
      case 's':
        return { action: e.shiftKey ? 'saveAs' : 'save' };
      case 'p':
        return { action: 'print' };
      case 'l':
        return e.shiftKey ? null : { action: 'library' };
      case 'e':
        return e.shiftKey ? null : { action: 'preview' };
      // The browser's page zoom keys zoom the label instead.
      case '=':
      case '+':
        return { action: 'zoomIn' };
      case '-':
        return { action: 'zoomOut' };
      case '0':
        return { action: 'zoomFit' };
    }
    if (typing) return null;
    switch (key) {
      case 'z':
        return { action: e.shiftKey ? 'redo' : 'undo' };
      case 'y':
        return mac ? null : { action: 'redo' };
      case 'c':
        return { action: 'copy' };
      case 'x':
        return { action: 'cut' };
      case 'v':
        return { action: 'paste' };
      case 'd':
        return { action: 'duplicate' };
    }
    return null;
  }

  if (typing || e.altKey || e.metaKey || e.ctrlKey) return null;
  if (key === 'Delete' || key === 'Backspace') return { action: 'delete' };
  if (key === 'Escape') return { action: 'deselect' };
  if (key === 'Enter') return { action: 'edit' };
  const step = e.shiftKey ? 1 : 0.1;
  switch (key) {
    case 'ArrowLeft':
      return { action: 'nudge', dx: -step, dy: 0 };
    case 'ArrowRight':
      return { action: 'nudge', dx: step, dy: 0 };
    case 'ArrowUp':
      return { action: 'nudge', dx: 0, dy: -step };
    case 'ArrowDown':
      return { action: 'nudge', dx: 0, dy: step };
  }
  return null;
}

/** Human label for a shortcut, e.g. "⌘S" or "Ctrl+S". */
export function shortcutLabel(keys: string, mac = isMac()): string {
  const parts = keys.split('+');
  if (mac) return parts.map((p) => ({ Mod: '⌘', Shift: '⇧', Alt: '⌥' })[p] ?? p).join('');
  return parts.map((p) => (p === 'Mod' ? 'Ctrl' : p)).join('+');
}
