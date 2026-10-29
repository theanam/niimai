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
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onConnect).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /browser/i }));
    expect(onBrowserPrint).toHaveBeenCalledWith(1);
  });

  it('hides the density slider for printers with one heat setting', () => {
    const props = { open: true, onOpenChange: () => {}, doc: createDoc(), preview: null, density: 1, onDensity: () => {}, onPrint: async () => {}, onBrowserPrint: async () => {}, onConnect: () => {} };
    const { unmount } = renderApp(<PrintDialog {...props} status={{ state: 'ready', profile: findManualProfile('d11')! }} />);
    expect(screen.getByRole('slider', { name: 'Density' })).toBeInTheDocument();
    unmount();
    const escpos = { ...findManualProfile('b1')!, densityMin: 1, densityMax: 1, kind: 'thermal' as const };
    renderApp(<PrintDialog {...props} status={{ state: 'ready', profile: escpos }} />);
    expect(screen.queryByRole('slider', { name: 'Density' })).toBeNull();
  });

  it('shows the printer at a glance and opens its settings', async () => {
    const onConnect = vi.fn();
    const props = { open: true, onOpenChange: () => {}, doc: createDoc(), preview: null, density: 2, onDensity: () => {}, onPrint: async () => {}, onBrowserPrint: async () => {}, onConnect };
    const { unmount } = renderApp(
      <PrintDialog
        {...props}
        status={{ state: 'ready', profile: findManualProfile('d110')!, battery: 64, label: { remaining: 124 } }}
        rollSize={{ widthMm: 30, heightMm: 15 }}
      />,
    );
    const strip = screen.getByRole('button', { name: 'Printer settings' });
    expect(strip).toHaveTextContent('D110 family');
    expect(strip).toHaveTextContent('64%');
    expect(strip).toHaveTextContent('30 × 15 mm roll · 124 left');
    await userEvent.click(strip);
    expect(onConnect).toHaveBeenCalled();
    unmount();

    renderApp(<PrintDialog {...props} status={{ state: 'disconnected', profile: null }} />);
    expect(screen.getByRole('button', { name: 'Connect a printer' })).toHaveTextContent('No printer connected');
  });

  it('shows continuous paper for thermal printers and leaves battery out when unknown', () => {
    const props = { open: true, onOpenChange: () => {}, doc: createDoc(), preview: null, density: 1, onDensity: () => {}, onPrint: async () => {}, onBrowserPrint: async () => {}, onConnect: () => {} };
    const thermal = { ...findManualProfile('b1')!, name: 'MP583', densityMax: 1, kind: 'thermal' as const };
    renderApp(<PrintDialog {...props} status={{ state: 'ready', profile: thermal }} />);
    const strip = screen.getByRole('button', { name: 'Printer settings' });
    expect(strip).toHaveTextContent('MP583');
    expect(strip).toHaveTextContent('Continuous paper');
    expect(strip).not.toHaveTextContent('%');
  });

  it('goes back to one copy after each print, and keeps the count when a print fails', async () => {
    let ok = true;
    const onPrint = vi.fn(async () => ok);
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
    const copies = screen.getByRole('spinbutton', { name: 'Copies' });
    await userEvent.click(screen.getByRole('button', { name: 'More copies' }));
    await userEvent.click(screen.getByRole('button', { name: 'More copies' }));
    expect(copies).toHaveValue(3);
    ok = false;
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(onPrint).toHaveBeenLastCalledWith(3);
    expect(copies).toHaveValue(3);
    ok = true;
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(copies).toHaveValue(1);
    await userEvent.click(screen.getByRole('button', { name: 'More copies' }));
    await userEvent.click(screen.getByRole('button', { name: /browser/i }));
    expect(copies).toHaveValue(1);
  });
});
