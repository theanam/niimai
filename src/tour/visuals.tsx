import { Barcode, Bluetooth, FileJson, HardDrive, Image, Lock, Plug, Printer, QrCode, ScanLine, Smile, Square, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LabelThumb } from '../components/LibraryDialog';
import { createDoc, createElement, type TextElement } from '../doc/model';
import { loadIconShapes } from '../icons/catalog';
import { bitsToRgba, dither, toGray } from '../render/dither';
import { linkFont } from '../render/fonts';
import { renderSvg } from '../render/svg';
import { shortcutLabel } from '../shortcuts/shortcuts';
import { templatePreview, templatesForSize, TEMPLATES } from '../templates';
import { Logo } from '../ui/Logo';

const pick = (kindId: string, w: number, h: number) =>
  templatePreview(templatesForSize({ widthMm: w, heightMm: h }).find((t) => t.kind.id === kindId)!);

export function WelcomeVisual() {
  const cards = [pick('spices-paprika', 50, 30), pick('tech-wifi', 50, 30), pick('kitchen-coffee', 50, 30)];
  return (
    <div className="tv-stack">
      {cards.map((doc, i) => (
        <div key={doc.id} className={`tv-stack-card tv-stack-${i}`}>
          <LabelThumb doc={doc} />
        </div>
      ))}
      <div className="tv-badge">
        <Logo size={44} />
      </div>
    </div>
  );
}

export function PrinterVisual() {
  return (
    <div className="tv-printer">
      <div className="tv-printer-hub">
        <Printer size={64} strokeWidth={1.5} />
        <span className="tv-pulse" />
      </div>
      <div className="tv-chip tv-chip-a">
        <Bluetooth size={16} /> Bluetooth
      </div>
      <div className="tv-chip tv-chip-b">
        <Plug size={16} /> USB
      </div>
      <div className="tv-chip tv-chip-c">
        <ScanLine size={16} /> 50 × 30 mm · 137 left
      </div>
      <div className="tv-models">
        {['D11', 'D110', 'B1', 'B18', 'B21', 'B21 C2B', '+60 more'].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

export function TemplatesVisual() {
  const docs = [
    pick('retail-price', 40, 30),
    pick('safety-caution', 40, 12),
    pick('events-badge', 50, 30),
    pick('lab-sample', 30, 15),
    pick('inventory-asset', 50, 30),
    pick('garden-tomato', 40, 30),
  ];
  return (
    <div className="tv-templates">
      {docs.map((d) => (
        <div key={d.id} className="tv-template">
          <LabelThumb doc={d} />
        </div>
      ))}
      <div className="tv-count">{TEMPLATES.length.toLocaleString()} templates</div>
    </div>
  );
}

export function CanvasVisual() {
  const doc = createDoc({ widthMm: 50, heightMm: 30 });
  const title = { ...(createElement('text', doc) as TextElement), x: 4, y: 4, w: 30, h: 12, text: 'Sourdough', fontFamily: 'Fraunces', bold: true, align: 'left' as const };
  const sub = { ...(createElement('text', doc) as TextElement), x: 4, y: 17, w: 30, h: 5, text: 'Baked today', fontFamily: 'Inter', align: 'left' as const };
  doc.elements = [title, sub, { ...createElement('qr', doc), x: 36, y: 8, w: 11, h: 11 }];
  useEffect(() => void linkFont('Fraunces'), []);
  const svg = renderSvg(doc, { physicalSize: false });
  const tools = [Type, Image, Smile, QrCode, Barcode, Square];
  return (
    <div className="tv-canvas">
      <div className="tv-canvas-paper">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="tv-select" style={{ left: '8%', top: '13%', width: '60%', height: '40%' }}>
          <span className="tv-caret" />
        </div>
        <div className="tv-guide" style={{ left: '8%' }} />
      </div>
      <div className="tv-tools">
        {tools.map((Icon, i) => (
          <span key={i}>
            <Icon size={20} />
          </span>
        ))}
      </div>
    </div>
  );
}

const SHOWCASE_FONTS = ['Fraunces', 'Caveat', 'Space Grotesk', 'Bebas Neue', 'Playfair Display', 'JetBrains Mono'];
const SHOWCASE_ICONS = ['package', 'coffee', 'leaf', 'heart', 'wifi-high', 'warning', 'gift', 'truck', 'flask', 'book-open', 'bicycle', 'cake'];

export function FontsIconsVisual() {
  const [shapes, setShapes] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    SHOWCASE_FONTS.forEach((f) => void linkFont(f));
    let live = true;
    loadIconShapes('bold').then((s) => live && setShapes(s), () => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="tv-fonts">
      <div className="tv-font-list">
        {SHOWCASE_FONTS.map((f) => (
          <span key={f} style={{ fontFamily: `'${f}', sans-serif` }}>
            {f}
          </span>
        ))}
      </div>
      <div className="tv-icon-grid">
        {SHOWCASE_ICONS.map((name) => (
          <span key={name}>
            {shapes?.[name] && <svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: shapes[name] }} />}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A shaded sphere, drawn once in grey and once through the printer's dithering. */
export function DitherVisual() {
  const grey = useRef<HTMLCanvasElement>(null);
  const dots = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const size = 120;
    const a = grey.current?.getContext('2d');
    const b = dots.current?.getContext('2d');
    if (!a || !b) return;
    const g = a.createRadialGradient(size * 0.35, size * 0.35, 4, size / 2, size / 2, size / 2);
    g.addColorStop(0, '#fff');
    g.addColorStop(1, '#111');
    a.fillStyle = '#fff';
    a.fillRect(0, 0, size, size);
    a.fillStyle = g;
    a.beginPath();
    a.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    a.fill();
    const data = a.getImageData(0, 0, size, size);
    const out = b.createImageData(size, size);
    bitsToRgba(dither(toGray(data.data), size, size, 'floyd'), out.data);
    b.putImageData(out, 0, 0);
  }, []);
  return (
    <div className="tv-dither">
      <figure>
        <canvas ref={grey} width={120} height={120} />
        <figcaption>On screen</figcaption>
      </figure>
      <span className="tv-arrow">→</span>
      <figure>
        <canvas ref={dots} width={120} height={120} className="tv-pixelated" />
        <figcaption>On the label</figcaption>
      </figure>
    </div>
  );
}

export function FilesVisual() {
  const items = [
    { icon: HardDrive, label: 'Saved on your device' },
    { icon: FileJson, label: '.niimai files' },
    { icon: Printer, label: 'Vector browser print' },
    { icon: Lock, label: 'No account, no upload' },
  ];
  return (
    <div className="tv-files">
      {items.map(({ icon: Icon, label }) => (
        <div key={label} className="tv-file">
          <Icon size={30} strokeWidth={1.5} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function KeysVisual() {
  const keys: [string, string][] = [
    ['Mod+N', 'New'],
    ['Mod+O', 'Open'],
    ['Mod+S', 'Save'],
    ['Mod+P', 'Print'],
    ['Mod+Z', 'Undo'],
    ['Mod+D', 'Duplicate'],
    ['Mod+E', 'Preview'],
    ['Enter', 'Edit text'],
  ];
  return (
    <div className="tv-keys">
      {keys.map(([k, label]) => (
        <div key={k} className="tv-key">
          <kbd>{shortcutLabel(k)}</kbd>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function ReadyVisual() {
  return (
    <div className="tv-ready">
      <Logo size={96} />
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="tv-confetti" style={{ ['--i' as string]: i }} />
      ))}
    </div>
  );
}
