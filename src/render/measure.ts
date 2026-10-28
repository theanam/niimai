/** Width of `text` in em units (1 = font size) for the given CSS font. */
export type MeasureFn = (text: string, family: string, bold: boolean, italic: boolean) => number;

let ctx: CanvasRenderingContext2D | null | undefined;

export const measureText: MeasureFn = (text, family, bold, italic) => {
  if (ctx === undefined) {
    try {
      ctx = document.createElement('canvas').getContext('2d');
    } catch {
      ctx = null;
    }
  }
  if (!ctx) return text.length * 0.55;
  ctx.font = `${italic ? 'italic ' : ''}${bold ? 700 : 400} 100px "${family}", sans-serif`;
  return ctx.measureText(text).width / 100;
};
