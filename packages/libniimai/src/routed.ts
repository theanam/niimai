import type { ClientLike } from './client';

/**
 * A client that picks the real client when it connects, then passes
 * everything through to it: the Bluetooth and USB printers behind the
 * Connect buttons.
 */
export abstract class RoutedClient implements ClientLike {
  protected inner: ClientLike | null = null;

  abstract connect(): Promise<{ deviceName?: string }>;

  protected get client(): ClientLike {
    if (!this.inner) throw new Error('Not connected');
    return this.inner;
  }

  async disconnect() {
    await this.inner?.disconnect();
  }

  isConnected() {
    return !!this.inner?.isConnected();
  }

  on(event: string, fn: (e: any) => void) {
    return this.client.on(event, fn);
  }

  off(event: string, fn: (e: any) => void) {
    return this.inner?.off(event, fn);
  }

  getPrinterInfo() {
    return this.inner?.getPrinterInfo() ?? {};
  }

  getModelMetadata() {
    return this.inner?.getModelMetadata();
  }

  getPrintTaskType() {
    return this.inner?.getPrintTaskType();
  }

  getRfidInfo() {
    return this.inner?.getRfidInfo() ?? {};
  }

  fetchRfidInfo() {
    return this.client.fetchRfidInfo();
  }

  startHeartbeat() {
    this.inner?.startHeartbeat();
  }

  stopHeartbeat() {
    this.inner?.stopHeartbeat();
  }

  isHeartbeatStarted() {
    return !!this.inner?.isHeartbeatStarted?.();
  }

  get protocol() {
    return this.client.protocol;
  }

  get encodePage() {
    return this.inner?.encodePage?.bind(this.inner);
  }

  get rollKey() {
    return this.inner?.rollKey?.bind(this.inner);
  }

  get feedPaper() {
    return this.inner?.feedPaper?.bind(this.inner);
  }

  get feedsBack() {
    return this.inner?.feedsBack;
  }
}
