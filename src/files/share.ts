/**
 * Labels shared as links. The whole label travels in the link itself,
 * compressed, after #/l/, so opening one needs no server and nothing is
 * uploaded anywhere.
 */
import { parseDoc, type LabelDoc } from '../doc/model';
import { uid } from '../lib/units';

export const SHARE_PREFIX = '#/l/';
/** Past this many characters, chat apps and some browsers may cut the link short. */
export const LONG_LINK = 8000;

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> =>
  new Uint8Array(await new Response(new Response(bytes as BodyInit).body!.pipeThrough(stream)).arrayBuffer());

/** The label as link text. Its file name and printer stay on this device. */
export async function encodeShare(doc: LabelDoc): Promise<string> {
  const { fileName: _f, printer: _p, ...shared } = doc;
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(shared)), new CompressionStream('deflate-raw')));
}

/** A copy of the shared label, with an id of its own so it never replaces one already saved. */
export async function decodeShare(text: string): Promise<LabelDoc> {
  const json = new TextDecoder().decode(await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw')));
  const now = Date.now();
  return { ...parseDoc(JSON.parse(json)), id: uid(), createdAt: now, updatedAt: now };
}

/** The link that opens the label, on this copy of the app. */
export async function shareUrl(doc: LabelDoc, base = `${location.origin}${location.pathname}`): Promise<string> {
  return `${base}${SHARE_PREFIX}${await encodeShare(doc)}`;
}

/** The label text in a share link's hash, if it is one. */
export const sharedPart = (hash: string): string | null => (hash.startsWith(SHARE_PREFIX) && hash.length > SHARE_PREFIX.length ? hash.slice(SHARE_PREFIX.length) : null);
