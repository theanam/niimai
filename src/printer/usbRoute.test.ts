import { usbRoute } from './usbRoute';

describe('USB routing', () => {
  it('starts with serial, so NIIMBOT printers connect as before', () => {
    expect(usbRoute(null, false, true, true)).toEqual({ primary: 'serial', other: 'usb' });
    expect(usbRoute('d110', false, true, true).primary).toBe('serial');
  });

  it('goes to USB printers for label and receipt printers, or one the site already uses', () => {
    expect(usbRoute('tspl', false, true, true)).toEqual({ primary: 'usb', other: 'serial' });
    expect(usbRoute('escpos-58', false, true, true).primary).toBe('usb');
    expect(usbRoute('cat', false, true, true).primary).toBe('serial');
    expect(usbRoute(null, true, true, true).primary).toBe('usb');
  });

  it('uses whichever the browser has when it has only one', () => {
    expect(usbRoute(null, false, false, true)).toEqual({ primary: 'usb', other: null });
    expect(usbRoute('tspl', true, true, false)).toEqual({ primary: 'serial', other: null });
  });
});
