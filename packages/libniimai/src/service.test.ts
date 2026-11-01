import { DEMO_META, MockClient } from './mock';
import { friendlyError, PrinterService, shiftCanvas } from './service';

const setup = (meta?: ConstructorParameters<typeof MockClient>[0] | null) => {
  const client = new MockClient(meta === undefined ? undefined : meta);
  const encode = vi.fn(() => ({ encoded: true }));
  const service = new PrinterService(async () => client, encode);
  return { client, encode, service };
};

const canvas = () => document.createElement('canvas');

/** A B21 C2B on protocol 0, the firmware that needs the B21_V1 task. */
const b21c2b = async () => {
  const ctx = setup({ ...DEMO_META, model: 'B21_C2B', printDirection: 'top', printheadPixels: 384 } as typeof DEMO_META);
  ctx.client.protocolVersion = 0;
  await ctx.service.connect('demo');
  return ctx;
};

describe('printer service', () => {
  beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));

  it('connects and reports model, battery and roll', async () => {
    const { service } = setup();
    const seen: string[] = [];
    service.subscribe((s) => seen.push(s.state));
    await service.connect('demo');
    const s = service.getStatus();
    expect(s.state).toBe('ready');
    expect(s.deviceName).toBe('Demo printer');
    expect(s.battery).toBe(80);
    expect(s.profile?.printTask).toBe('D11_V1');
    // It prints like a D11 but is named as the demo.
    expect(s.profile?.name).toBe('Demo printer');
    expect(s.detectedModel).toBe('D11');
    expect(s.label).toEqual({ widthMm: 40, heightMm: 12, remaining: 198, capacity: 210, barcode: '6971501227941', paper: 'gaps' });
    expect(seen).toContain('connecting');
  });

  it('reports the roll barcode when the printer does not report its size', async () => {
    const { service, client } = setup();
    client.reportsPaperSize = false;
    await service.connect('demo');
    expect(service.getStatus().label).toEqual({ widthMm: undefined, heightMm: undefined, remaining: 198, capacity: 210, barcode: '6971501227941', paper: 'gaps' });
  });

  it('prints the encoded page with the requested copies and clamped density', async () => {
    const { service, client, encode } = setup();
    await service.connect('demo');
    const newTask = vi.spyOn(client.protocol, 'newPrintTask');
    await service.print(canvas(), { density: 9, copies: 3 });
    expect(encode).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 'left');
    expect(newTask).toHaveBeenCalledWith('D11_V1', expect.objectContaining({ totalPages: 3, density: 3 }));
    expect(client.printed).toEqual([{ image: { encoded: true }, quantity: 3, heartbeat: false }]);
    expect(newTask.mock.calls[0][1]).toMatchObject({ pageColor: 0 });
    expect(service.getStatus().state).toBe('ready');
  });

  it('pauses the heartbeat while printing and resumes it after', async () => {
    const { service, client } = setup();
    await service.connect('demo');
    expect(client.heartbeat).toBe(true);
    await service.print(canvas(), { density: 2, copies: 1 });
    expect(client.printed[0].heartbeat).toBe(false);
    expect(client.heartbeat).toBe(true);
  });

  it('polls print end for the B21_V1 task until the printer is done', async () => {
    const { service, client } = await b21c2b();
    expect(service.getStatus().profile?.printTask).toBe('B21_V1');
    client.printEndPending = 3;
    const end = vi.spyOn(client.protocol, 'printEnd');
    const waitForFinished = vi.fn();
    const newTask = client.protocol.newPrintTask;
    vi.spyOn(client.protocol, 'newPrintTask').mockImplementation((name, o) => ({ ...newTask(name, o), waitForFinished }));
    await service.print(canvas(), { density: 3, copies: 1 });
    expect(waitForFinished).not.toHaveBeenCalled();
    expect(end.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(service.getStatus().state).toBe('ready');
  });

  it('gives up when the printer never confirms', async () => {
    vi.useFakeTimers();
    try {
      const { service, client } = await b21c2b();
      client.printEndPending = Number.POSITIVE_INFINITY;
      const result = service.print(canvas(), { density: 3, copies: 1 }).catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(31_000);
      expect(((await result) as Error).message).toBe('The printer did not confirm the print');
      expect(service.getStatus().state).toBe('ready');
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses to print when disconnected', async () => {
    const { service } = setup();
    await expect(service.print(canvas(), { density: 2, copies: 1 })).rejects.toThrow(/connect/i);
  });

  it('asks for a printer type when the model is unknown', async () => {
    const { service } = setup(null);
    await service.connect('demo');
    expect(service.getStatus().profile).toBeNull();
    await expect(service.print(canvas(), { density: 2, copies: 1 })).rejects.toThrow(/printer type/i);
    service.setManualProfile('d11');
    expect(service.getStatus().profile?.id).toBe('d11');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(service.print(canvas(), { density: 2, copies: 1 })).resolves.toBeUndefined();
  });

  it('recovers to ready after a failed print', async () => {
    const { service, client } = setup();
    await service.connect('demo');
    client.failNextPrint = 'Timeout waiting for response';
    await expect(service.print(canvas(), { density: 2, copies: 1 })).rejects.toThrow('Printer stopped responding');
    expect(service.getStatus().state).toBe('ready');
  });

  it('resets when the printer disconnects', async () => {
    const { service, client } = setup();
    await service.connect('demo');
    client.emit('disconnect', {});
    expect(service.getStatus()).toEqual({ state: 'disconnected', profile: null });
  });

  it('tracks heartbeat and print progress', async () => {
    const { service, client } = setup();
    await service.connect('demo');
    client.emit('heartbeat', { data: { batteryPercents: 42, lidClosed: false } });
    expect(service.getStatus()).toMatchObject({ battery: 42, lidClosed: false });
  });

  it('turns connection failures into readable errors', async () => {
    const service = new PrinterService(async () => {
      throw new Error('User cancelled the requestDevice() chooser.');
    }, vi.fn());
    await expect(service.connect('bluetooth')).rejects.toThrow('Connection cancelled');
    expect(service.getStatus().state).toBe('disconnected');
  });

  it('maps common error messages', () => {
    expect(friendlyError(new Error('GATT Server is disconnected'))).toBe('Printer disconnected');
    expect(friendlyError('weird')).toBe('weird');
  });

  it('shifts the page by the print offset', async () => {
    const draws: number[][] = [];
    const ctx = { fillRect() {}, drawImage: (_c: unknown, x: number, y: number) => draws.push([x, y]), fillStyle: '' };
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const page = canvas();
    expect(shiftCanvas(page, 0, 0.3)).toBe(page);
    const moved = shiftCanvas(page, 8.4, -4);
    expect(moved).not.toBe(page);
    expect(draws).toEqual([[8, -4]]);
    spy.mockRestore();
  });

  it('applies the offset in printer dots before sending', async () => {
    const { service, encode } = setup();
    await service.connect('demo');
    const draws: number[][] = [];
    const ctx = { fillRect() {}, drawImage: (_c: unknown, x: number, y: number) => draws.push([x, y]), fillStyle: '', getImageData: () => ({ data: [] }) };
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const page = Object.assign(canvas(), { width: 320, height: 96 });
    await service.print(page, { density: 2, copies: 1, offset: { x: 1, y: -0.5 } });
    // 203 dpi: 1 mm is 8 dots.
    expect(draws[0]).toEqual([8, -4]);
    expect((encode.mock.calls[0] as unknown[])[0]).not.toBe(page);
    spy.mockRestore();
  });

  it('prints a batch of different labels as one job, drawing each page as it goes', async () => {
    const { service, client, encode } = setup();
    await service.connect('demo');
    const newTask = vi.spyOn(client.protocol, 'newPrintTask');
    const page = vi.fn(async (_index: number) => canvas());
    await service.print({ count: 3, page }, { density: 3, copies: 2 });
    expect(page.mock.calls.map((c) => c[0])).toEqual([0, 1, 2]);
    expect(encode).toHaveBeenCalledTimes(3);
    expect(newTask).toHaveBeenCalledWith('D11_V1', expect.objectContaining({ totalPages: 6 }));
    expect(client.printed.map((p) => p.quantity)).toEqual([2, 2, 2]);
  });
});
