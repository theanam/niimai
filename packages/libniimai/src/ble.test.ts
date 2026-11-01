import { CANDIDATE_SERVICES, describeBleError, pickChannel } from './ble';

const char = (uuid: string, p: Partial<{ notify: boolean; indicate: boolean; write: boolean; writeWithoutResponse: boolean }>) => ({
  uuid,
  properties: { notify: false, write: false, writeWithoutResponse: false, ...p },
});
const service = (uuid: string, chars: ReturnType<typeof char>[]) => ({ uuid, getCharacteristics: async () => chars });

describe('BLE channel selection', () => {
  it('prefers one characteristic that notifies and writes (NIIMBOT layout)', async () => {
    const both = char('bef8', { notify: true, writeWithoutResponse: true });
    const ch = await pickChannel([service('other', [char('w', { write: true }), char('n', { notify: true })]), service('e781', [both])]);
    expect(ch).toEqual({ write: both, notify: both });
  });

  it('pairs separate write and notify characteristics in one service', async () => {
    const w = char('ae01', { writeWithoutResponse: true });
    const n = char('ae02', { notify: true });
    expect(await pickChannel([service('ae30', [w, n])])).toEqual({ write: w, notify: n });
  });

  it('accepts indicate in place of notify', async () => {
    const w = char('w', { write: true });
    const n = char('n', { indicate: true });
    expect(await pickChannel([service('s', [w, n])])).toEqual({ write: w, notify: n });
  });

  it('never pairs characteristics across services', async () => {
    expect(await pickChannel([service('a', [char('w', { write: true })]), service('b', [char('n', { notify: true })])])).toBeNull();
  });

  it('asks for the standard NIIMBOT service first', () => {
    expect(CANDIDATE_SERVICES[0]).toBe('e7810a71-73ae-499d-8c15-faa9aef0c3f2');
  });

  it('includes the B21 C2B service', () => {
    expect(CANDIDATE_SERVICES).toContain('0000e0ff-3c17-d293-8e48-14fe2e4da212');
  });

  it('picks ffe1 on the B21 C2B layout', async () => {
    const ffe1 = char('0000ffe1', { notify: true, write: true, writeWithoutResponse: true });
    const ffe9 = char('0000ffe9', { write: true, writeWithoutResponse: true });
    const ffea = char('0000ffea', { notify: true });
    expect(await pickChannel([service('0000e0ff', [ffe1, ffe9, ffea])])).toEqual({ write: ffe1, notify: ffe1 });
  });

  it('explains a missing service', () => {
    expect(describeBleError(new Error('No Services found in device.')).message).toMatch(/unknown Bluetooth service/);
    expect(describeBleError(new Error('Suitable characteristic not found'), ['abc']).message).toContain('abc');
    expect(describeBleError(new Error('other')).message).toBe('other');
  });
});
