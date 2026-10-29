import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDoc } from '../doc/model';
import { findManualProfile } from '../printer/profiles';
import { renderApp } from '../test/render';
import { PrintDialog, sizeWarning } from './PrintDialog';

describe('print dialog', () => {
  it('warns only when part of the design falls outside the printhead', () => {
    const d11 = findManualProfile('d11')!;
    expect(sizeWarning(d11, false)).toBeNull();
    expect(sizeWarning(d11, true)).toMatch(/12 mm printhead will not print/);
    expect(sizeWarning(null, true)).toBeNull();
  });

  it('prints the chosen number of copies', async () => {
    const onPrint = vi.fn(async () => {});
    renderApp(
      <PrintDialog
        open
        onOpenChange={() => {}}
        doc={createDoc()}
        status={{ state: 'ready', profile: findManualProfile('d11')! }}
        preview={null}
        density={2}
        onDensity={() => {}}
        onPrint={onPrint}
        onBrowserPrint={async () => {}}
        onConnect={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More copies' }));
    await userEvent.click(screen.getByRole('button', { name: 'More copies' }));
    await userEvent.click(screen.getByRole('button', { name: /^print$/i }));
    expect(onPrint).toHaveBeenCalledWith(3);
  });

  it('offers to connect when no printer is connected', async () => {
    const onConnect = vi.fn();
    const onBrowserPrint = vi.fn(async () => {});
    renderApp(
      <PrintDialog
        open
        onOpenChange={() => {}}
        doc={createDoc()}
        status={{ state: 'disconnected', profile: null }}
        preview={null}
        density={2}
        onDensity={() => {}}
        onPrint={async () => {}}
        onBrowserPrint={onBrowserPrint}
        onConnect={onConnect}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /connect/i }));
    expect(onConnect).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /browser/i }));
    expect(onBrowserPrint).toHaveBeenCalledWith(1);
  });
});
