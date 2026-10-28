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

  it('about credits niimbluelib and links the repo, issues and email', () => {
    renderApp(<About />);
    expect(screen.getByRole('link', { name: 'niimbluelib' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /source code/i })).toHaveAttribute('href', REPO_URL);
    expect(screen.getByRole('link', { name: /issues/i })).toHaveAttribute('href', ISSUES_URL);
    expect(screen.getByRole('link', { name: new RegExp(CONTACT_EMAIL) })).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
  });
});
