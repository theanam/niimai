import { Bug, Mail } from 'lucide-react';
import { GitHubMark } from '../ui/GitHubMark';
import { CONTACT_EMAIL, ISSUES_URL, REPO_URL } from '../ui/links';
import { Logo, Wordmark } from '../ui/Logo';
import { PageShell } from './PageShell';

export function About() {
  return (
    <PageShell title="About">
      <section className="about-hero">
        <Logo size={72} />
        <div>
          <h2>
            <Wordmark height={30} />
          </h2>
          <p>A label designer for NIIMBOT and other Bluetooth thermal printers that runs entirely in your browser.</p>
        </div>
      </section>
      <section>
        <p>
          Labels are stored on your device. Nothing is uploaded, and there is no account. The app talks to the printer
          directly over Web Bluetooth or Web Serial.
        </p>
        <p>
          Printer communication is powered by{' '}
          <a href="https://github.com/MultiMote/niimbluelib" target="_blank" rel="noreferrer">
            niimbluelib
          </a>
          , the open source NIIMBOT protocol library by MultiMote. The cat printer protocol comes from{' '}
          <a href="https://github.com/rbaron/catprinter" target="_blank" rel="noreferrer">
            rbaron/catprinter
          </a>{' '}
          and{' '}
          <a href="https://github.com/NaitLee/Cat-Printer" target="_blank" rel="noreferrer">
            NaitLee/Cat-Printer
          </a>
          . Icons come from{' '}
          <a href="https://phosphoricons.com" target="_blank" rel="noreferrer">
            Phosphor Icons
          </a>{' '}
          (MIT). niimai is an independent project and is not affiliated with NIIMBOT.
        </p>
      </section>
      <section>
        <p className="link-row">
          <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
            <GitHubMark size={16} /> Source code
          </a>
          <a className="btn" href={ISSUES_URL} target="_blank" rel="noreferrer">
            <Bug size={16} /> Issues
          </a>
          <a className="btn" href={`mailto:${CONTACT_EMAIL}`}>
            <Mail size={16} /> {CONTACT_EMAIL}
          </a>
        </p>
        <p className="muted small">MIT licensed.</p>
      </section>
    </PageShell>
  );
}
