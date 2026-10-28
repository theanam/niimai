import * as RD from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { TOUR_STEPS } from './steps';

/** Bump when the tour gains steps worth showing to people who saw an older one. */
export const TOUR_KEY = 'niimai.tour.v1';
export const REPLAY_EVENT = 'niimai:tour';

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'done';
  } catch {
    // Storage can be blocked; showing the tour again is the safe outcome.
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(TOUR_KEY, 'done');
  } catch {
    // Nothing to do: without storage the tour simply shows next time.
  }
}

export function replayTour(): void {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

/** The first-run tour. Shows once, can be skipped at any point, and replays from Help. */
export function Tour() {
  const [open, setOpen] = useState(() => !tourSeen());
  const [index, setIndex] = useState(0);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  useEffect(() => {
    const replay = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, []);

  const close = () => {
    markSeen();
    setOpen(false);
  };
  const next = () => (last ? close() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <RD.Root open={open} onOpenChange={(o) => !o && close()}>
      <RD.Portal>
        <RD.Overlay className="dialog-overlay tour-overlay" />
        <RD.Content
          className="tour"
          aria-describedby="tour-body"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') back();
          }}
        >
          <div className="tour-visual" key={step.id}>
            <ErrorBoundary name="Tour visual" fallback={() => null}>
              <step.Visual />
            </ErrorBoundary>
          </div>
          <div className="tour-text">
            <div className="tour-top">
              <span className="tour-count">
                {index + 1} / {TOUR_STEPS.length}
              </span>
              <RD.Close className="btn btn-ghost tour-skip" aria-label="Skip tour">
                Skip <X size={14} />
              </RD.Close>
            </div>
            <div className="tour-copy" key={step.id}>
              <RD.Title className="tour-title">{step.title}</RD.Title>
              <RD.Description id="tour-body" className="tour-body">
                {step.body}
              </RD.Description>
              {step.highlights.length > 0 && (
                <ul className="tour-highlights">
                  {step.highlights.map((h) => (
                    <li key={h}>
                      <Check size={15} /> {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="tour-nav">
              <div className="tour-dots" role="tablist" aria-label="Tour steps">
                {TOUR_STEPS.map((s, i) => (
                  <button key={s.id} role="tab" aria-selected={i === index} aria-label={`Step ${i + 1}: ${s.title}`} className={i === index ? 'active' : ''} onClick={() => setIndex(i)} />
                ))}
              </div>
              <div className="tour-buttons">
                {index > 0 && (
                  <button className="icon-btn" onClick={back} aria-label="Back">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <button className="btn btn-primary" onClick={next} autoFocus>
                  {last ? "Let's go" : 'Next'} {!last && <ArrowRight size={16} />}
                </button>
              </div>
            </div>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
