import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { GitHubMark } from '../ui/GitHubMark';
import { REPO_URL } from '../ui/links';
import { LogoLockup } from '../ui/Logo';

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page-header">
        <a href="#/" className="icon-btn" aria-label="Back to editor" title="Back to editor">
          <ArrowLeft size={18} />
        </a>
        <a href="#/" className="brand">
          <LogoLockup size={26} />
        </a>
        <span className="spacer" />
        <a href={REPO_URL} className="icon-btn" target="_blank" rel="noreferrer" aria-label="GitHub repository" title="GitHub repository">
          <GitHubMark />
        </a>
      </header>
      <main className="page-body">
        <h1>{title}</h1>
        <ErrorBoundary name={title}>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
