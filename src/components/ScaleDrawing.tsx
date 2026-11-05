import type { ScaleReadings } from '../printer/scale';

/** Stickers the scale drawing shows, as [top, bottom]; the first is cut off where the paper sat. */
const STICKERS: [number, number][] = [
  [-40, 40],
  [50, 130],
  [140, 220],
  [230, 310],
];
const START = 12;
const CX = 110;
const ROW = 72;

/** Where each reading is taken in the drawing: an edge across the roll (y) or along it (x). */
const MARKS: Record<keyof ScaleReadings, { label: string; y?: number; x?: number }> = {
  top: { label: 'Top', y: 50 },
  bottom: { label: 'Bottom', y: 130 },
  next: { label: 'Next', y: 140 },
  last: { label: 'Last', y: 230 },
  left: { label: 'Left', x: 52 },
  right: { label: 'Right', x: 168 },
};

/**
 * The sticker scale on a roll loaded mid-sticker: printed from where the
 * paper sat, showing only on the stickers, since the backing takes no print.
 * With `mark`, one edge is picked out as the one to read; without, every
 * reading is labelled.
 */
export function ScaleDrawing({ mark }: { mark?: keyof ScaleReadings }) {
  const picked = mark && MARKS[mark];
  return (
    <svg viewBox="-24 0 280 320" aria-hidden="true">
      <rect className="mg-liner" x={40} y={0} width={140} height={320} />
      {STICKERS.map(([top, bottom]) => (
        <rect key={top} className="mg-sticker" x={52} y={top} width={116} height={bottom - top} rx={6} />
      ))}
      {STICKERS.map(([top, bottom]) => {
        const from = Math.max(top, START);
        const ticks = [];
        for (let y = Math.ceil(from / 4) * 4; y <= bottom; y += 4) ticks.push(<line key={y} x1={(y - START) % 20 ? CX - 3 : CX - 6} x2={(y - START) % 20 ? CX + 3 : CX + 6} y1={y} y2={y} />);
        return (
          <g key={top} className="mg-scale">
            <line x1={CX} x2={CX} y1={from} y2={bottom} />
            {ticks}
          </g>
        );
      })}
      <g className="mg-scale">
        {Array.from({ length: 30 }, (_, i) => 52 + i * 4).map((x) => (
          <line key={x} x1={x} x2={x} y1={ROW} y2={(x - 52) % 20 ? ROW + 4 : ROW + 7} />
        ))}
      </g>
      {picked ? (
        <g className="mg-mark">
          {picked.y !== undefined ? (
            <>
              <line x1={52} x2={168} y1={picked.y} y2={picked.y} />
              <circle cx={CX} cy={picked.y} r={7} />
              <text x={194} y={picked.y} dominantBaseline="middle">
                Read here
              </text>
            </>
          ) : (
            <>
              <line x1={picked.x} x2={picked.x} y1={50} y2={130} />
              <circle cx={picked.x} cy={ROW + 2} r={7} />
              <text x={picked.x! < CX ? 30 : 190} y={ROW + 2} textAnchor={picked.x! < CX ? 'end' : 'start'} dominantBaseline="middle">
                Read here
              </text>
            </>
          )}
        </g>
      ) : (
        <g className="mg-dim">
          <text x={36} y={START} textAnchor="end" dominantBaseline="middle">
            Start
          </text>
          <text x={56} y={64} dominantBaseline="middle">
            Left
          </text>
          <text x={164} y={64} textAnchor="end" dominantBaseline="middle">
            Right
          </text>
          {(['top', 'bottom', 'last'] as const).map((k) => (
            <g key={k}>
              <line x1={172} x2={190} y1={MARKS[k].y} y2={MARKS[k].y} />
              <text x={194} y={MARKS[k].y} dominantBaseline="middle">
                {MARKS[k].label}
              </text>
            </g>
          ))}
          <line x1={48} x2={30} y1={MARKS.next.y} y2={MARKS.next.y} />
          <text x={26} y={MARKS.next.y} textAnchor="end" dominantBaseline="middle">
            {MARKS.next.label}
          </text>
        </g>
      )}
    </svg>
  );
}

/** One millimetre of scale in the close-up, in drawing units. */
const ZOOM_MM = 11;
const EDGE_MM = 28;
const EDGE_Y = 44;
const zoomY = (mm: number) => EDGE_Y + (mm - EDGE_MM) * ZOOM_MM;

/**
 * A close-up of a sticker's top edge crossing the scale: the scale prints
 * only below the edge, on the sticker. The edge reads 28: two marks before
 * 30, one mark to a millimetre.
 */
export function EdgeZoom() {
  const marks = Array.from({ length: 13 }, (_, i) => EDGE_MM - 3 + i).filter((m) => zoomY(m) >= 4 && zoomY(m) <= 146);
  return (
    <svg viewBox="0 0 246 150" aria-hidden="true">
      <rect className="mg-liner" x={0} y={0} width={246} height={150} />
      <rect className="mg-sticker" x={30} y={EDGE_Y} width={186} height={130} rx={10} />
      <g className="mg-ghost">
        <line x1={110} x2={110} y1={Math.max(4, zoomY(EDGE_MM - 3))} y2={EDGE_Y} />
        {marks
          .filter((m) => m < EDGE_MM)
          .map((m) => (
            <line key={m} x1={m % 5 ? 104 : 98} x2={m % 5 ? 116 : 122} y1={zoomY(m)} y2={zoomY(m)} />
          ))}
        <text x={132} y={Math.max(10, zoomY(25))} dominantBaseline="middle">
          25
        </text>
      </g>
      <g className="mg-scale">
        <line x1={110} x2={110} y1={EDGE_Y} y2={150} />
        {marks
          .filter((m) => m >= EDGE_MM)
          .map((m) => (
            <line key={m} x1={m % 5 ? 104 : 98} x2={m % 5 ? 116 : 122} y1={zoomY(m)} y2={zoomY(m)} />
          ))}
        <text className="mg-scale-number" x={132} y={zoomY(30)} dominantBaseline="middle">
          30
        </text>
        <text className="mg-scale-number" x={132} y={zoomY(35)} dominantBaseline="middle">
          35
        </text>
      </g>
      <g className="mg-mark">
        <line x1={30} x2={216} y1={EDGE_Y} y2={EDGE_Y} />
        <text x={40} y={EDGE_Y + 16} dominantBaseline="middle">
          Edge
        </text>
        <text x={40} y={EDGE_Y + 32} dominantBaseline="middle">
          reads 28
        </text>
      </g>
    </svg>
  );
}
