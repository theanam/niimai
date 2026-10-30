/**
 * Local file access, modelled on theanam/betterScad.
 *
 * Uses the File System Access API where it exists (Chrome, Edge), so Save
 * writes back to the same file. Other browsers get `<input type="file">` and
 * downloads behind the same functions.
 */

type Accept = { description: string; accept: Record<string, string[]> };

interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<string>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<string>;
}

interface PickerWindow {
  showOpenFilePicker?(o: { types?: Accept[]; multiple?: boolean; excludeAcceptAllOption?: boolean }): Promise<FileHandle[]>;
  showSaveFilePicker?(o: { suggestedName?: string; types?: Accept[] }): Promise<FileHandle>;
}

export type { FileHandle };

export const LABEL_EXT = '.niimai';
const LABEL_TYPES: Accept[] = [{ description: 'niimai label', accept: { 'application/json': [LABEL_EXT, '.json'] } }];
const IMAGE_TYPES: Accept[] = [
  { description: 'Images', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'] } },
];

const SHEET_TYPES: Accept[] = [
  {
    description: 'Spreadsheets',
    accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  },
];

const win = (): PickerWindow => (typeof window === 'undefined' ? {} : (window as unknown as PickerWindow));
export const supportsFileSystemAccess = (): boolean => typeof win().showOpenFilePicker === 'function';
export const supportsFileSystemWrite = (): boolean => typeof win().showSaveFilePicker === 'function';

export interface OpenedFile {
  name: string;
  file: File;
  /** Present only when the browser can write back in place. */
  handle?: FileHandle;
}

/** What a save attempt did. A cancelled picker and a fallback download are different outcomes. */
export type SaveOutcome =
  | { status: 'saved'; handle: FileHandle }
  | { status: 'downloaded' }
  | { status: 'cancelled' }
  | { status: 'failed'; reason: string };

const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === 'AbortError';

async function open(types: Accept[], accept: string): Promise<OpenedFile | null> {
  const w = win();
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({ types, multiple: false, excludeAcceptAllOption: false });
      return { name: handle.name, file: await handle.getFile(), handle };
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }
  const file = await pickWithInput(accept);
  return file ? { name: file.name, file } : null;
}

export const openLabelFile = (): Promise<OpenedFile | null> => open(LABEL_TYPES, `${LABEL_EXT},.json,application/json`);
export const openSheetFile = (): Promise<OpenedFile | null> => open(SHEET_TYPES, '.csv,.tsv,.xlsx,text/csv');
export const openImageFile = (): Promise<OpenedFile | null> => open(IMAGE_TYPES, 'image/*');

/** Writes to an existing handle. False when permission is gone, so the caller can fall back to Save As. */
export async function writeToHandle(handle: FileHandle, text: string): Promise<boolean> {
  try {
    if (handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await handle.requestPermission?.({ mode: 'readwrite' })) !== 'granted') return false;
    }
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function saveTextAs(suggestedName: string, text: string): Promise<SaveOutcome> {
  const w = win();
  if (w.showSaveFilePicker) {
    let handle: FileHandle;
    try {
      handle = await w.showSaveFilePicker({ suggestedName, types: LABEL_TYPES });
    } catch (err) {
      if (isAbort(err)) return { status: 'cancelled' };
      return { status: 'failed', reason: (err as Error).message };
    }
    if (!(await writeToHandle(handle, text))) return { status: 'failed', reason: `Could not write ${handle.name}` };
    return { status: 'saved', handle };
  }
  downloadBlob(new Blob([text], { type: 'application/json' }), suggestedName);
  return { status: 'downloaded' };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function pickWithInput(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

/** A file's name without the label extension. */
export const baseName = (fileName: string): string => fileName.replace(/\.(niimai|json)$/i, '') || fileName;

export const safeFileName = (name: string): string => (name.trim() || 'label').replace(/[\\/:*?"<>|]+/g, '-');

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
