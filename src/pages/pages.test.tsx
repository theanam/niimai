import { screen } from '@testing-library/react';
import { renderApp } from '../test/render';
import { CONTACT_EMAIL, ISSUES_URL, REPO_URL } from '../ui/links';
import { About } from './About';
import { Help } from './Help';

describe('help and about pages', () => {
  it('help links to the issue tracker and the contact email', () => {
    renderApp(<Help />);
    expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /report an issue/i })).toHaveAttribute('href', ISSUES_URL);
    expect(screen.getByRole('link', { name: new RegExp(CONTACT_EMAIL) })).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    expect(screen.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute('href', REPO_URL);
  });

  it('help opens on the browser setup topic a link points to', () => {
    window.location.hash = '#/help/linux';
    try {
      renderApp(<Help />);
      expect(screen.getByRole('heading', { name: 'Browser setup' })).toBeInTheDocument();
      const linux = screen.getByRole('heading', { name: /Chrome on Linux/ }).parentElement!;
      expect(linux).toHaveClass('setup-target');
      expect(linux).toHaveTextContent('chrome://flags/#enable-web-bluetooth');
      expect(screen.getByRole('button', { name: 'Copy chrome://flags/#enable-web-bluetooth' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Brave' }).parentElement).not.toHaveClass('setup-target');
    } finally {
      window.location.hash = '';
    }
  });

  it('about credits niimbluelib and links the repo, issues and email', () => {
    renderApp(<About />);
    expect(screen.getByRole('link', { name: 'niimbluelib' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /source code/i })).toHaveAttribute('href', REPO_URL);
    expect(screen.getByRole('link', { name: /issues/i })).toHaveAttribute('href', ISSUES_URL);
    expect(screen.getByRole('link', { name: new RegExp(CONTACT_EMAIL) })).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
  });
});
