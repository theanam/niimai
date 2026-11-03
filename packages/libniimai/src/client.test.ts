import { connectErrorTopic, detectBrowser, detectPlatform, supportIssue, unsupportedReason } from './client';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const LINUX_CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CHROMEOS = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';
const ANDROID_SAMSUNG = 'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
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

  it('names the browser and the system', () => {
    expect(detectBrowser({ ua: LINUX_CHROME, touchPoints: 0, brave: false })).toEqual({ os: 'linux', browser: 'chrome', chromium: true, secure: true });
    expect(detectBrowser({ ua: LINUX_CHROME, touchPoints: 0, brave: true }).browser).toBe('brave');
    expect(detectBrowser({ ua: WIN_EDGE, touchPoints: 0, brave: false })).toMatchObject({ os: 'windows', browser: 'edge' });
    expect(detectBrowser({ ua: MAC_SAFARI, touchPoints: 0, brave: false })).toMatchObject({ os: 'mac', browser: 'safari', chromium: false });
    expect(detectBrowser({ ua: LINUX_FIREFOX, touchPoints: 0, brave: false })).toMatchObject({ os: 'linux', browser: 'firefox', chromium: false });
    expect(detectBrowser({ ua: CHROMEOS, touchPoints: 0, brave: false }).os).toBe('chromeos');
    expect(detectBrowser({ ua: ANDROID_SAMSUNG, touchPoints: 5, brave: false })).toMatchObject({ os: 'android', browser: 'samsung' });
    // Chrome on iPhone is WebKit underneath.
    expect(detectBrowser({ ua: IPHONE_CHROME, touchPoints: 5, brave: false })).toMatchObject({ os: 'ios', browser: 'chrome', chromium: false });
  });

  it('points each browser to the Help topic that fixes it', () => {
    const env = (ua: string, more = {}) => ({ ua, touchPoints: 0, brave: false, secure: true, ...more });
    expect(supportIssue('bluetooth', env(LINUX_CHROME))).toEqual({ reason: 'Needs a Chrome flag on Linux', topic: 'linux' });
    expect(supportIssue('bluetooth', env(LINUX_CHROME, { brave: true }))?.topic).toBe('brave');
    expect(supportIssue('serial', env(LINUX_CHROME, { brave: true }))?.topic).toBe('brave');
    expect(supportIssue('bluetooth', env(LINUX_CHROME, { secure: false }))?.topic).toBe('https');
    expect(supportIssue('bluetooth', env(LINUX_FIREFOX))).toEqual({ reason: 'Firefox has no Bluetooth access; use Chrome or Edge', topic: 'browsers' });
    expect(supportIssue('serial', env(MAC_SAFARI))?.reason).toMatch(/^Safari has no USB access/);
    expect(supportIssue('bluetooth', env(IPHONE_CHROME, { touchPoints: 5 }))?.topic).toBe('ios');
    expect(supportIssue('bluetooth', env(ANDROID_SAMSUNG, { touchPoints: 5 }))?.reason).toBe('Open niimai in Chrome');
    expect(supportIssue('bluetooth', env(ANDROID, { touchPoints: 5 }))?.reason).toBe('Update Chrome');
    expect(supportIssue('bluetooth', env(WIN_EDGE))?.reason).toBe('Turned off in this browser');
    expect(supportIssue('demo', env(LINUX_FIREFOX))).toBeNull();
  });

  it('recognises the errors of a browser that has Bluetooth but cannot use it', () => {
    expect(connectErrorTopic(new Error('Web Bluetooth API globally disabled.'))).toBe('brave');
    expect(connectErrorTopic(new Error('Bluetooth adapter not available.'))).not.toBeNull();
    expect(connectErrorTopic(new Error('User cancelled the requestDevice() chooser.'))).toBeNull();
  });
});
