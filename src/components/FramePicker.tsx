import { FRAME_STYLES, frameSvg, type FrameStyle } from '../render/frames';

/** One frame style drawn small, for picking. */
function FramePreview({ style }: { style: FrameStyle }) {
  const svg = frameSvg(style, { x: 1, y: 1, w: 38, h: 22 }, 1.4, 'currentColor');
  return <svg className="frame-preview" viewBox="0 0 40 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** A grid of frame styles. */
export function FramePicker({ value, onPick }: { value?: FrameStyle; onPick: (style: FrameStyle) => void }) {
  return (
    <div className="frame-grid" role="listbox" aria-label="Frame styles">
      {FRAME_STYLES.map((f) => (
        <button
          key={f.value}
          type="button"
          role="option"
          aria-selected={f.value === value}
          aria-label={f.label}
          title={f.label}
          className={`frame-option${f.value === value ? ' active' : ''}`}
          onClick={() => onPick(f.value)}
        >
          <FramePreview style={f.value} />
        </button>
      ))}
    </div>
  );
}
