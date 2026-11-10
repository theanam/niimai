import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { friendlyError } from 'libniimai';
import { isStalled, StalledDialog } from './StalledDialog';

describe('stalled printer', () => {
  it('knows the errors a stuck printer gives, and only those', () => {
    expect(isStalled(friendlyError(new Error('Timeout')))).toBe(true);
    expect(isStalled(friendlyError(new Error('Timeout waiting for the printer to finish')))).toBe(true);
    for (const err of ['Lid is open', 'No paper', 'GATT server is disconnected', 'Already printing']) expect(isStalled(friendlyError(new Error(err)))).toBe(false);
  });

  it('shows the steps that clear it and closes on Done', async () => {
    const onOpenChange = vi.fn();
    render(<StalledDialog open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog', { name: 'Printer stopped responding' })).toBeInTheDocument();
    expect(screen.getByText('Turn the printer off and on.')).toBeInTheDocument();
    expect(screen.getByText('Open the lid, reseat the roll and close it.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
