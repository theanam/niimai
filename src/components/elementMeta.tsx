import { Barcode, Circle, Image, Minus, QrCode, Smile, Square, Type } from 'lucide-react';
import type { ElementType } from '../doc/model';

export const ELEMENT_META: Record<ElementType, { label: string; icon: typeof Type }> = {
  text: { label: 'Text', icon: Type },
  image: { label: 'Image', icon: Image },
  qr: { label: 'QR code', icon: QrCode },
  barcode: { label: 'Barcode', icon: Barcode },
  icon: { label: 'Icon', icon: Smile },
  rect: { label: 'Rectangle', icon: Square },
  ellipse: { label: 'Ellipse', icon: Circle },
  line: { label: 'Line', icon: Minus },
};

export const ELEMENT_ORDER: ElementType[] = ['text', 'image', 'icon', 'qr', 'barcode', 'rect', 'ellipse', 'line'];
