import { createBleClient } from './ble';
import type { ClientLike, ConnectionKind } from './client';
import { MockClient } from './mock';
import { PrinterService } from './service';

// niimbluelib loads only when it is needed, which keeps first paint light.
const lib = () => import('@mmote/niimbluelib');

async function createClient(kind: ConnectionKind): Promise<ClientLike> {
  if (kind === 'demo') return new MockClient();
  const niim = await lib();
  const client = kind === 'serial' ? new niim.NiimbotSerialClient() : createBleClient(niim);
  return client as unknown as ClientLike;
}

export const printer = new PrinterService(createClient, async (canvas, direction) =>
  (await lib()).ImageEncoder.encodeCanvas(canvas, 0, direction),
);
