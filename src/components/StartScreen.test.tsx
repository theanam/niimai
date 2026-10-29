import { screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { resetDbConnection, saveLabel, listLabels } from '../storage/db';
import userEvent from '@testing-library/user-event';
import { createDoc } from '../doc/model';
import { renderApp } from '../test/render';
import { StartScreen } from './StartScreen';

const renderStart = (onBrowseTemplates = vi.fn(), extra: Partial<Parameters<typeof StartScreen>[0]> = {}) => {
  renderApp(
    <StartScreen
      status={{ state: 'disconnected', profile: null }}
      roll={{ size: null, key: null, needsSize: false }}
      defaultSize={{ widthMm: 50, heightMm: 30 }}
      onConnect={async () => {}}
      onSetRollSize={() => {}}
      onOpen={() => {}}
      onBlank={() => {}}
      onBrowseTemplates={onBrowseTemplates}
      {...extra}
    />,
  );
  return onBrowseTemplates;
};

describe('start screen', () => {
  it('filters templates as you type', async () => {
    renderStart();
    const suggested = screen.getByRole('list', { name: 'Suggested templates' });
    expect(suggested.children.length).toBeGreaterThan(0);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'perfume');
    const matches = screen.getByRole('list', { name: 'Matching templates' });
    expect(matches.textContent?.toLowerCase()).toMatch(/perfume|decant|sample|tester/);
  });

  it('opens the library with the search', async () => {
    const browse = renderStart();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'perfume');
    await userEvent.click(screen.getByRole('button', { name: /see all matches/i }));
    expect(browse).toHaveBeenCalledWith({ query: 'perfume' });
  });

  it('opens every template', async () => {
    const browse = renderStart();
    await userEvent.click(screen.getByRole('button', { name: /all [\d,]+ templates/i }));
    expect(browse).toHaveBeenCalledWith(undefined);
  });

  it('says when nothing matches', async () => {
    renderStart();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'zzqqxx');
    expect(screen.getByText('No templates match at this size.')).toBeInTheDocument();
  });

  it('starts a label or templates from the loaded roll once connected', async () => {
    const onBlank = vi.fn();
    const browse = renderStart(vi.fn(), {
      status: { state: 'ready', profile: null, deviceName: 'D110', battery: 25, label: { remaining: 124 } },
      roll: { size: { widthMm: 30, heightMm: 15 }, key: 'r', needsSize: false, name: 'White 30 × 15' },
      onBlank,
    });
    expect(screen.getByText('124 labels left')).toBeInTheDocument();
    expect(screen.getByText('White 30 × 15')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /new 30 × 15 label/i }));
    expect(onBlank).toHaveBeenCalledWith({ widthMm: 30, heightMm: 15 });
    await userEvent.click(screen.getByRole('button', { name: /templates for this roll/i }));
    expect(browse).toHaveBeenCalledWith();
  });

  it('asks for the roll size when the printer cannot report it', async () => {
    const onSetRollSize = vi.fn();
    renderStart(vi.fn(), { status: { state: 'ready', profile: null }, roll: { size: null, key: 'r', needsSize: true }, onSetRollSize });
    await userEvent.click(screen.getByRole('button', { name: /set roll size/i }));
    expect(onSetRollSize).toHaveBeenCalled();
  });

  it('deletes any recent label after confirming', async () => {
    globalThis.indexedDB = new IDBFactory();
    resetDbConnection();
    await saveLabel({ ...createDoc(), name: 'Last used' });
    await saveLabel({ ...createDoc(), name: 'Old label' });
    renderStart();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Last used' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Last used' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Delete Old label' })).toBeInTheDocument();
    expect((await listLabels()).map((d) => d.name)).toEqual(['Old label']);
  });

  it('offers a 48 mm label on continuous paper for a cat printer', async () => {
    const onBlank = vi.fn();
    renderStart(vi.fn(), {
      status: { state: 'ready', profile: { id: 'auto:MX06', name: 'MX06', dpi: 203, printheadPixels: 384, printDirection: 'top', printTask: 'B1', densityMin: 1, densityMax: 5, densityDefault: 3, kind: 'cat' } },
      onBlank,
    });
    expect(screen.getByText('Continuous paper')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /new 48 × 30 label/i }));
    expect(onBlank).toHaveBeenCalledWith({ widthMm: 48, heightMm: 30 });
  });
});
