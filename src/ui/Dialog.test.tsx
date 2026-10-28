import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmProvider, useConfirm } from './Dialog';

function Asker() {
  const confirm = useConfirm();
  const [answer, setAnswer] = useState('none');
  return (
    <>
      <button onClick={async () => setAnswer(String(await confirm({ title: 'Delete it?', confirmLabel: 'Delete' })))}>ask</button>
      <output>{answer}</output>
    </>
  );
}

describe('confirm dialog', () => {
  it('resolves true on confirm without using window.confirm', async () => {
    const native = vi.spyOn(window, 'confirm');
    render(
      <ConfirmProvider>
        <Asker />
      </ConfirmProvider>,
    );
    await userEvent.click(screen.getByText('ask'));
    expect(screen.getByRole('dialog', { name: 'Delete it?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('status', { hidden: true }) ?? screen.getByText('true')).toBeTruthy();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(native).not.toHaveBeenCalled();
  });

  it('resolves false on cancel', async () => {
    render(
      <ConfirmProvider>
        <Asker />
      </ConfirmProvider>,
    );
    await userEvent.click(screen.getByText('ask'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('false')).toBeInTheDocument();
  });
});
