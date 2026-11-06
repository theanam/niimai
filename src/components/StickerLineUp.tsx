import { ArrowLeft, ArrowRight, CircleHelp, Crosshair, Ruler } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fromScale, scaleLength, SIZE_SLACK_MM, type ScaleReadings, type StickerSetup } from '../printer/scale';
import { MIN_LENGTH_MM } from '../printer/thermalPaper';
import { useConfirm } from '../ui/Dialog';
import { NumberField } from './fields';
import { EdgeZoom, ScaleDrawing } from './ScaleDrawing';

interface Props {
  headWidth: number;
  /** The sticker length and gap set now; the length starts the guess the scale is sized from. */
  length: number;
  gap: number;
  canRetract: boolean;
  printing: boolean;
  /** Prints the scale, sized for stickers about this long, from wherever the paper sits. Resolves to the length printed. */
  onTest: (aboutMm: number) => Promise<number>;
  onFix: (next: StickerSetup, feedMm: number) => void;
  onHelp: () => void;
}

/** The readings, one question at a time, in the order the eye follows the strip. */
const STEPS: { key: keyof ScaleReadings; label: string; icon: string; question: string; optional?: boolean }[] = [
  { key: 'top', label: 'Sticker top', icon: 'Top', question: "Pick a sticker the scale runs into from its top. What number is at that sticker's top edge?" },
  { key: 'bottom', label: 'Sticker bottom', icon: 'Bottom', question: 'Follow the scale down the same sticker. What number is at its bottom edge?' },
  { key: 'next', label: 'Next sticker top', icon: 'Next', question: 'The scale picks up again on the next sticker. What number is at its top edge?' },
  { key: 'last', label: 'Last sticker top', icon: 'Last', question: 'Does the scale reach another sticker after that? What number is at the top of the last one? Skip if not.', optional: true },
  { key: 'left', label: 'Left edge', icon: 'Left', question: 'Now across. On any sticker, a row of marks runs side to side. What number is at the sticker’s left edge?' },
  { key: 'right', label: 'Right edge', icon: 'Right', question: 'And on the same row, what number is at its right edge?' },
];

/** A reading in the working shown under the result: negatives in brackets, so "− −2" never shows. */
const num = (v: number) => (v < 0 ? `(−${-v})` : String(v));

/**
 * Prints a long scale from wherever the paper sits, then walks through
 * reading it: the scale prints only on the stickers, so each sticker edge
 * cuts it off at a number. From those it sets the sticker size, the gap and
 * where the print sits, and moves the paper so the next sticker starts at
 * the print head. No ruler needed.
 */
export function StickerLineUp({ headWidth, length, gap, canRetract, printing, onTest, onFix, onHelp }: Props) {
  /** About how long one sticker is: the shorter the guess, the less scale is printed. */
  const [about, setAbout] = useState(length);
  /** The length of the scale printed here; the paper stopped at its end. */
  const [printed, setPrinted] = useState<number | null>(null);
  const [readings, setReadings] = useState<Partial<ScaleReadings>>({});
  const [step, setStep] = useState(0);

  const confirm = useConfirm();
  const print = async () => {
    // The scale uses up stickers, and a strip torn off before Fix can drag the roll out of line.
    const stickers = Math.ceil(scaleLength(about, gap) / (about + Math.max(gap, 1)));
    const ok = await confirm({
      title: 'Print the sticker scale?',
      description: `It uses about ${stickers} stickers. Leave the printed strip on the roll until Fix has run: tearing it off can pull the roll out of line.`,
      confirmLabel: 'Print scale',
    });
    if (!ok) return;
    await onTest(about).then(
      (length) => {
        setPrinted(length);
        setReadings({});
        setStep(0);
      },
      (err: Error) => toast.error(err.message),
    );
  };

  const done = step >= STEPS.length;
  const all = { top: 0, bottom: 0, next: 0, last: 0, left: 0, right: 0, ...readings };
  const result = printed !== null && done ? fromScale(all, headWidth, printed, canRetract) : null;
  const fix = () => {
    if (!result || 'error' in result) return;
    const { feedMm, ...next } = result;
    onFix(next, feedMm);
    setPrinted(null);
    toast.success(`Stickers ${next.width} × ${next.length} mm with a ${next.gap} mm gap. The next sticker is lined up on the print head.`);
  };

  const current = STEPS[step];
  const answered = current && readings[current.key] !== undefined;

  return (
    <details className="custom-size pd-sticker-test">
      <summary>Line up stickers</summary>
      <div className="pd-sticker-body">
        {printed === null && (
          <div className="pd-reading-group">
            <span className="pd-reading-title">About how long is one sticker?</span>
            <NumberField label="Sticker length, about" icon="L" value={about} min={MIN_LENGTH_MM} max={300} step={1} suffix="mm" onChange={setAbout} />
          </div>
        )}
        <div className="pd-test-row">
          <button className="btn" onClick={() => void print()} disabled={printing}>
            <Ruler size={16} /> {printed === null ? 'Print scale' : 'Print again'}
          </button>
          <button className="link-btn pd-guide" onClick={onHelp}>
            <CircleHelp size={14} /> How it works
          </button>
        </div>
        {printed === null ? (
          <small className="muted">
            Prints {scaleLength(about, gap)} mm of scale from wherever the paper sits, enough for stickers up to {about + SIZE_SLACK_MM} mm long. Then you read a few numbers off it, step
            by step. No ruler needed.
          </small>
        ) : !done ? (
          <div className="lu-step" role="group" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            <span className="lu-count">
              Step {step + 1} of {STEPS.length}
            </span>
            <p className="lu-question">{current.question}</p>
            <div className="lu-figures">
              <ScaleDrawing mark={current.key} />
              {step === 0 && (
                <figure className="lu-zoom">
                  <EdgeZoom />
                  <figcaption>The scale prints only on the sticker. Count the marks from the nearest number: each mark is 1 mm.</figcaption>
                </figure>
              )}
            </div>
            <NumberField
              key={current.key}
              label={current.label}
              icon={current.icon}
              value={readings[current.key] ?? 0}
              min={-100}
              max={500}
              step={0.5}
              suffix="mm"
              onChange={(v) => setReadings((r) => ({ ...r, [current.key]: v }))}
            />
            <div className="lu-nav">
              <button className="btn" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
                <ArrowLeft size={16} /> Back
              </button>
              {current.optional && !answered && (
                <button className="link-btn" onClick={() => setStep((s) => s + 1)}>
                  Skip
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!answered}>
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="lu-step" role="group" aria-label="Result">
            {result && 'error' in result ? (
              <p className="pd-scale-result error" role="status">
                {result.error}
              </p>
            ) : (
              result && (
                <p className="pd-scale-result" role="status">
                  {result.width} × {result.length} mm stickers, {result.gap} mm gap
                  <span className="lu-working">
                    Length {num(all.bottom)} − {num(all.top)} = {result.length} mm · Gap {num(all.next)} − {num(all.bottom)} = {result.gap} mm · Width {num(all.right)} −{' '}
                    {num(all.left)} = {result.width} mm
                  </span>
                </p>
              )
            )}
            <div className="lu-finish">
              <button className="btn btn-primary" onClick={fix} disabled={!result || 'error' in result || printing}>
                <Crosshair size={16} /> Fix size, gap and position
              </button>
              <button className="link-btn" onClick={() => setStep(0)}>
                <ArrowLeft size={14} /> Check the numbers
              </button>
            </div>
            <small className="muted">Fix before printing anything else: the paper moves on from where the scale stopped.</small>
          </div>
        )}
      </div>
    </details>
  );
}
