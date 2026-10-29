import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDoc } from '../doc/model';
import { rollMismatch } from '../printer/roll';
import { RollMismatchBanner } from './RollMismatchBanner';

describe('roll mismatch', () => {
  it('flags a different size or paper and ignores fold mode', () => {
    const doc = { widthMm: 40, heightMm: 12 };
    expect(rollMismatch(doc, { widthMm: 40, heightMm: 12 }, 'gaps')).toBeNull();
    expect(rollMismatch(doc, { widthMm: 30, heightMm: 15 }, undefined)).toEqual({ size: true, paper: false });
    expect(rollMismatch({ ...doc, paper: 'continuous' }, null, 'gaps')).toEqual({ size: false, paper: true });
    expect(rollMismatch({ ...doc, paper: 'gaps' }, null, 'gaps')).toBeNull();
    const cable = { widthMm: 109, heightMm: 12.5, tailMm: 35 };
    expect(rollMismatch({ ...cable, fold: 'none' }, { ...cable, fold: 'copy' }, undefined)).toBeNull();
    expect(rollMismatch({ widthMm: 109, heightMm: 12.5 }, cable, undefined)).toEqual({ size: true, paper: false });
  });

  it('nags with both sizes and matches the roll on request', async () => {
    const onMatch = vi.fn();
    render(<RollMismatchBanner doc={createDoc({ widthMm: 40, heightMm: 12 })} rollSize={{ widthMm: 30, heightMm: 15 }} onMatch={onMatch} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Design is 40 × 12 mm, the printer has 30 × 15 mm labels.');
    await userEvent.click(screen.getByRole('button', { name: 'Match the roll' }));
    expect(onMatch).toHaveBeenCalled();
  });

  it('stays hidden when the design fits the roll', () => {
    render(<RollMismatchBanner doc={createDoc({ widthMm: 30, heightMm: 15 })} rollSize={{ widthMm: 30, heightMm: 15 }} onMatch={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
