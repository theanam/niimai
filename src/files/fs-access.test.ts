import { openLabelFile, safeFileName, saveTextAs, supportsFileSystemAccess, writeToHandle, type FileHandle } from './fs-access';

const w = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete w.showOpenFilePicker;
  delete w.showSaveFilePicker;
  vi.restoreAllMocks();
});

const fakeHandle = (name = 'a.niimai') => {
  const written: unknown[] = [];
  const handle: FileHandle = {
    name,
    getFile: async () => new File(['{}'], name),
    createWritable: async () => ({ write: async (d) => void written.push(d), close: async () => {} }),
    queryPermission: async () => 'granted',
  };
  return { handle, written };
};

describe('file access', () => {
  it('uses the save picker when available', async () => {
    const { handle, written } = fakeHandle();
    w.showSaveFilePicker = vi.fn(async () => handle);
    const out = await saveTextAs('a.niimai', 'hello');
    expect(out).toEqual({ status: 'saved', handle });
    expect(written).toEqual(['hello']);
  });

  it('reports a cancelled picker as cancelled', async () => {
    w.showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('no', 'AbortError');
    });
    expect(await saveTextAs('a.niimai', 'x')).toEqual({ status: 'cancelled' });
  });

  it('falls back to a download', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(await saveTextAs('a.niimai', 'x')).toEqual({ status: 'downloaded' });
    expect(click).toHaveBeenCalled();
  });

  it('opens through the open picker', async () => {
    const { handle } = fakeHandle('b.niimai');
    w.showOpenFilePicker = vi.fn(async () => [handle]);
    expect(supportsFileSystemAccess()).toBe(true);
    const opened = await openLabelFile();
    expect(opened?.name).toBe('b.niimai');
    expect(opened?.handle).toBe(handle);
  });

  it('opens through a file input when the picker is missing', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [new File(['{}'], 'c.json')] });
      this.dispatchEvent(new Event('change'));
    });
    const opened = await openLabelFile();
    expect(click).toHaveBeenCalled();
    expect(opened?.name).toBe('c.json');
    expect(opened?.handle).toBeUndefined();
  });

  it('reports a lost write permission', async () => {
    const { handle } = fakeHandle();
    handle.queryPermission = async () => 'prompt';
    handle.requestPermission = async () => 'denied';
    expect(await writeToHandle(handle, 'x')).toBe(false);
  });

  it('makes safe file names', () => {
    expect(safeFileName('a/b:c')).toBe('a-b-c');
    expect(safeFileName('  ')).toBe('label');
  });
});
