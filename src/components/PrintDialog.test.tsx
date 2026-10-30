import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDoc, createElement, type LabelDoc } from '../doc/model';
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

  describe('batches', () => {
    const labelWith = (text: string, extra: Partial<LabelDoc> = {}): LabelDoc => {
      const doc = createDoc();
      return { ...doc, ...extra, elements: [{ ...createElement('text', doc), text, dynamic: true } as LabelDoc['elements'][number]] };
    };
    const sheet = { name: 'items.csv', columns: ['Name'], rows: ['A', 'B', 'C', 'D', 'E'].map((n) => [n]) };
    const open = (doc: LabelDoc, extra: Partial<Parameters<typeof PrintDialog>[0]> = {}) => {
      const onPrint = vi.fn(async () => {});
      renderApp(
        <PrintDialog
          open
          onOpenChange={() => {}}
          doc={doc}
          status={{ state: 'ready', profile: findManualProfile('d11')! }}
          preview={null}
          density={2}
          onDensity={() => {}}
          onPrint={onPrint}
          onBrowserPrint={async () => {}}
          onConnect={() => {}}
          {...extra}
        />,
      );
      return onPrint;
    };

    it('prints every sheet row by default, or the rows chosen', async () => {
      const onPrint = open(labelWith('{{Name}}', { sheet }));
      expect(screen.getByRole('button', { name: 'Print 5' })).toBeInTheDocument();
      const from = screen.getByRole('spinbutton', { name: 'First row' });
      await userEvent.clear(from);
      await userEvent.type(from, '2');
      const to = screen.getByRole('spinbutton', { name: 'Last row' });
      await userEvent.clear(to);
      await userEvent.type(to, '3');
      await userEvent.click(screen.getByRole('button', { name: 'More copies' }));
      await userEvent.click(screen.getByRole('button', { name: 'Print 4' }));
      expect(onPrint).toHaveBeenCalledWith(2, { first: 1, count: 2 });
    });

    it('prints as many numbers as asked, from where they start', async () => {
      const onSequence = vi.fn();
      const onPrint = open(labelWith('SN-{{Number}}', { sequence: { start: 1, step: 1, digits: 3 } }), { onSequence });
      const labels = screen.getByRole('spinbutton', { name: 'Labels' });
      await userEvent.clear(labels);
      await userEvent.type(labels, '25');
      expect(screen.getByText('001 to 025')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Print 25' }));
      expect(onPrint).toHaveBeenCalledWith(1, { first: 0, count: 25 });
    });

    it('prints a whole numbered range by default', () => {
      open(labelWith('{{Number}}', { sequence: { start: 101, step: 1, digits: 1, end: 150 } }));
      expect(screen.getByRole('spinbutton', { name: 'Labels' })).toHaveValue(50);
      expect(screen.getByText('101 to 150')).toBeInTheDocument();
    });

    it('asks for a sheet when a field has no column', async () => {
      const onAddSheet = vi.fn();
      open(labelWith('{{Name}}'), { onAddSheet });
      expect(screen.getByText('Needs a sheet for {{Name}}')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Add sheet' }));
      expect(onAddSheet).toHaveBeenCalled();
    });

    it('leaves the batch out for labels with nothing that varies', () => {
      open(labelWith('{{Date}}'));
      expect(screen.queryByRole('region', { name: 'Batch' })).toBeNull();
      expect(screen.getByRole('button', { name: /^print$/i })).toBeInTheDocument();
    });
  });
});
