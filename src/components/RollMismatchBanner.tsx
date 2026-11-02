import { TriangleAlert } from 'lucide-react';
import { paperSize, sizeLabel, type LabelDoc, type LabelSize } from '../doc/model';
import { paperName, type PaperType } from 'libniimai';
import { rollMismatch } from '../printer/roll';

interface Props {
  doc: LabelDoc;
  rollSize: LabelSize | null;
  rollPaper?: PaperType;
  /** Switches the design to the loaded roll's size and paper. */
  onMatch: () => void;
  className?: string;
}

/** Stays in view while the design and the loaded roll disagree. */
export function RollMismatchBanner({ doc, rollSize, rollPaper, onMatch, className = '' }: Props) {
  // A landscape label's artboard is turned; the paper is what meets the roll.
  const size = paperSize(doc);
  const mismatch = rollMismatch({ ...size, paper: doc.paper }, rollSize, rollPaper);
  if (!mismatch) return null;
  const lines = [
    mismatch.size && rollSize && `Design is ${sizeLabel(size)} mm, the printer has ${sizeLabel(rollSize)} mm labels.`,
    mismatch.paper && doc.paper && rollPaper && `Design is set to ${paperName(doc.paper).toLowerCase()}, the roll is ${paperName(rollPaper).toLowerCase()}.`,
  ].filter(Boolean) as string[];
  return (
    <div className={`roll-mismatch ${className}`} role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <span className="roll-mismatch-text">
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </span>
      <button className="btn btn-sm" onClick={onMatch}>
        Match the roll
      </button>
    </div>
  );
}
