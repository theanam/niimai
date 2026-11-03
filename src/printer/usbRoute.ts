import { findPrinterType, rememberedUsbPrinters, supportsSerial, supportsUsb } from 'libniimai';
import { useEffect, useState } from 'react';

export type CableKind = 'serial' | 'usb';

export interface UsbRoute {
  /** What the USB button connects with. */
  primary: CableKind;
  /** The other kind, for printers missing from the first list; null when the browser has only one. */
  other: CableKind | null;
}

/**
 * Serial comes first, as NIIMBOT printers show up as serial ports. Label and
 * receipt printers show up as standard USB printers: the USB button goes
 * there when one is picked under Advanced, or when a USB printer this site
 * already uses is plugged in.
 */
export function usbRoute(typeId: string | null, rememberedPrinter: boolean, serial = supportsSerial(), usb = supportsUsb()): UsbRoute {
  const family = findPrinterType(typeId)?.family;
  const wantsUsb = usb && (!serial || rememberedPrinter || family === 'tspl' || family === 'escpos');
  const primary: CableKind = wantsUsb ? 'usb' : 'serial';
  const other: CableKind = primary === 'usb' ? 'serial' : 'usb';
  return { primary, other: serial && usb ? other : null };
}

/** usbRoute, kept up to date as USB printers come and go. */
export function useUsbRoute(typeId: string | null): UsbRoute {
  const [remembered, setRemembered] = useState(false);
  useEffect(() => {
    if (!supportsUsb()) return;
    const usb = navigator.usb;
    let live = true;
    const check = () => void rememberedUsbPrinters().then((d) => live && setRemembered(d.length > 0));
    check();
    usb.addEventListener('connect', check);
    usb.addEventListener('disconnect', check);
    return () => {
      live = false;
      usb.removeEventListener('connect', check);
      usb.removeEventListener('disconnect', check);
    };
  }, []);
  return usbRoute(typeId, remembered);
}
