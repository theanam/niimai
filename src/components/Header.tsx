import { CircleHelp, Eye, FilePlus2, FolderOpen, Info, Library, Printer, Redo2, Save, Undo2 } from 'lucide-react';
import type { PrinterStatus } from '../printer/service';
import { shortcutLabel } from '../shortcuts/shortcuts';
import { GitHubMark } from '../ui/GitHubMark';
import { IconButton } from '../ui/IconButton';
import { REPO_URL } from '../ui/links';
import { LogoLockup } from '../ui/Logo';

interface Props {
  name: string;
  onRename: (name: string) => void;
  onHome: () => void;
  canUndo: boolean;
  canRedo: boolean;
  preview: boolean;
  printer: PrinterStatus;
  onAction: (a: 'new' | 'open' | 'save' | 'library' | 'undo' | 'redo' | 'preview' | 'print' | 'printer') => void;
}

const STATE_LABEL: Record<PrinterStatus['state'], string> = {
  disconnected: 'Connect printer',
  connecting: 'Connecting…',
  ready: 'Printer ready',
  printing: 'Printing…',
};

export function Header({ name, onRename, onHome, canUndo, canRedo, preview, printer, onAction }: Props) {
  const k = shortcutLabel;
  return (
    <header className="app-header">
      <a
        href="#/"
        className="brand"
        aria-label="Start screen"
        title="Start screen"
        onClick={(e) => {
          e.preventDefault();
          onHome();
        }}
      >
        <LogoLockup />
      </a>
      <input className="doc-name" aria-label="Label name" value={name} onChange={(e) => onRename(e.target.value)} spellCheck={false} />

      <nav className="toolbar" aria-label="File">
        <IconButton label="New" shortcut={k('Mod+N')} onClick={() => onAction('new')}>
          <FilePlus2 size={18} />
        </IconButton>
        <IconButton label="Open" shortcut={k('Mod+O')} onClick={() => onAction('open')}>
          <FolderOpen size={18} />
        </IconButton>
        <IconButton label="Save" shortcut={k('Mod+S')} onClick={() => onAction('save')}>
          <Save size={18} />
        </IconButton>
        <IconButton label="Library" shortcut={k('Mod+L')} onClick={() => onAction('library')}>
          <Library size={18} />
        </IconButton>
        <span className="divider" />
        <IconButton label="Undo" shortcut={k('Mod+Z')} disabled={!canUndo} onClick={() => onAction('undo')}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Redo" shortcut={k('Mod+Shift+Z')} disabled={!canRedo} onClick={() => onAction('redo')}>
          <Redo2 size={18} />
        </IconButton>
        <span className="divider" />
        <IconButton label="Print preview" shortcut={k('Mod+E')} active={preview} onClick={() => onAction('preview')}>
          <Eye size={18} />
        </IconButton>
      </nav>

      <span className="spacer" />

      <button
        className={`printer-chip state-${printer.state}`}
        onClick={() => onAction('printer')}
        aria-label={STATE_LABEL[printer.state]}
        title={STATE_LABEL[printer.state]}
      >
        <span className="dot" />
        <span className="printer-chip-text">
          {printer.state === 'disconnected' ? 'Connect' : (printer.profile?.name ?? printer.deviceName ?? 'Printer')}
        </span>
        {printer.battery !== undefined && <span className="battery">{printer.battery}%</span>}
      </button>
      <button className="btn btn-primary" onClick={() => onAction('print')} title={`Print (${k('Mod+P')})`}>
        <Printer size={16} />
        <span className="hide-sm">Print</span>
      </button>

      <nav className="toolbar" aria-label="Links">
        <a className="icon-btn" href="#/help" aria-label="Help" title="Help">
          <CircleHelp size={18} />
        </a>
        <a className="icon-btn" href="#/about" aria-label="About" title="About">
          <Info size={18} />
        </a>
        <a className="icon-btn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository" title="GitHub repository">
          <GitHubMark />
        </a>
      </nav>
    </header>
  );
}
