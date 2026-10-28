import { detectPlatform, unsupportedReason } from './client';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

describe('platform support', () => {
  it('tells phones and desktops apart, including iPads that claim to be Macs', () => {
    expect(detectPlatform(IPHONE, 5)).toBe('ios');
    expect(detectPlatform(IPAD, 5)).toBe('ios');
    expect(detectPlatform(ANDROID, 5)).toBe('android');
    expect(detectPlatform(MAC, 0)).toBe('desktop');
  });

  it('explains what to do where Bluetooth or USB is missing', () => {
    // jsdom has neither Web Bluetooth nor Web Serial.
    expect(unsupportedReason('bluetooth', 'ios')).toMatch(/Bluefy/);
    expect(unsupportedReason('serial', 'ios')).toMatch(/Not available/);
    expect(unsupportedReason('bluetooth', 'android')).toMatch(/Chrome/);
    expect(unsupportedReason('serial', 'desktop')).toBe('Needs Chrome or Edge');
    expect(unsupportedReason('demo', 'ios')).toBeNull();
  });

  it('has no complaint when the browser supports the connection', () => {
    Object.defineProperty(navigator, 'bluetooth', { value: {}, configurable: true });
    try {
      expect(unsupportedReason('bluetooth', 'android')).toBeNull();
    } finally {
      delete (navigator as unknown as Record<string, unknown>).bluetooth;
    }
  });
});
