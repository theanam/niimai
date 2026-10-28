import { createDoc, type LabelDoc, type LabelSize } from '../doc/model';
import { sanitizeIconBody } from '../icons/catalog';
import ICON_SHAPES from './icon-shapes.json';
import KIND_ICONS from './kind-icons.json';
import { uid } from '../lib/units';
import { CATEGORIES, KINDS, type Category, type Kind } from './kinds';
import { layoutTemplate, type TemplateContent } from './layout';

export { CATEGORIES };

/** Common NIIMBOT roll sizes, from the D-series strips to the B-series squares. */
export const TEMPLATE_SIZES: LabelSize[] = [
  { widthMm: 22, heightMm: 14 },
  { widthMm: 26, heightMm: 15 },
  { widthMm: 30, heightMm: 12 },
  { widthMm: 40, heightMm: 12 },
  { widthMm: 30, heightMm: 15 },
  { widthMm: 50, heightMm: 15 },
  { widthMm: 50, heightMm: 20 },
  { widthMm: 40, heightMm: 30 },
  { widthMm: 50, heightMm: 30 },
  { widthMm: 50, heightMm: 40 },
  { widthMm: 40, heightMm: 40 },
  { widthMm: 50, heightMm: 50 },
];

/** Families with no bold face; their titles stay regular weight. */
const NO_BOLD = new Set(['DM Serif Display']);

const kindIcon = (kind: Kind): string | undefined => (KIND_ICONS as Record<string, string>)[kind.id];

export type TemplateVariant = 'text' | 'icon';

export interface Template {
  id: string;
  name: string;
  variant: TemplateVariant;
  category: string;
  size: LabelSize;
  /** Lowercased name, category and text, for search. */
  haystack: string;
  kind: Kind;
}

const categoryOf = (id: string): Category => CATEGORIES.find((c) => c.id === id)!;
export const sizeKey = (s: LabelSize): string => `${s.widthMm}x${s.heightMm}`;

const makeTemplate = (kind: Kind, size: LabelSize, variant: TemplateVariant): Template => ({
  id: `${kind.id}${variant === 'icon' ? '-icon' : ''}-${sizeKey(size)}`,
  name: kind.name,
  variant,
  category: kind.category,
  size,
  haystack: [kind.name, categoryOf(kind.category).name, kind.title, kind.pre, ...(kind.lines ?? []), variant === 'icon' ? `icon ${kindIcon(kind)}` : '']
    .join(' ')
    .toLowerCase(),
  kind,
});

/** A kind's templates for one size: the text version, then the icon version where the kind has an icon. */
const variantsFor = (kind: Kind, size: LabelSize): Template[] =>
  kindIcon(kind) ? [makeTemplate(kind, size, 'text'), makeTemplate(kind, size, 'icon')] : [makeTemplate(kind, size, 'text')];

/** The full catalog: every kind at every common roll size, with and without icons. */
export const TEMPLATES: Template[] = KINDS.flatMap((kind) => TEMPLATE_SIZES.flatMap((size) => variantsFor(kind, size)));

/** Every kind laid out for one label size, including sizes outside the catalog. */
export const templatesForSize = (size: LabelSize): Template[] => KINDS.flatMap((kind) => variantsFor(kind, size));

function content(kind: Kind, variant: TemplateVariant): TemplateContent {
  const cat = categoryOf(kind.category);
  const font = kind.font ?? cat.font;
  const iconName = variant === 'icon' ? kindIcon(kind) : undefined;
  const iconBody = iconName ? (ICON_SHAPES as Record<string, string>)[iconName] : undefined;
  return {
    icon: iconName && iconBody ? { name: iconName, body: sanitizeIconBody(iconBody) } : undefined,
    pre: kind.pre,
    title: kind.title,
    lines: kind.lines,
    code: kind.code,
    style: kind.style ?? cat.style,
    font,
    bodyFont: cat.bodyFont,
    titleBold: !NO_BOLD.has(font),
    align: kind.align,
    upper: cat.upper,
  };
}

const previews = new Map<string, LabelDoc>();

/** The template as a label, for thumbnails. Cached; never edit the result. */
export function templatePreview(t: Template): LabelDoc {
  let doc = previews.get(t.id);
  if (!doc) {
    doc = { ...createDoc(t.size, t.name), id: t.id, elements: layoutTemplate(content(t.kind, t.variant), t.size) };
    previews.set(t.id, doc);
  }
  return doc;
}

/** A fresh, editable label made from the template. */
export function labelFromTemplate(t: Template): LabelDoc {
  const doc = createDoc(t.size, t.name);
  return { ...doc, elements: layoutTemplate(content(t.kind, t.variant), t.size).map((el) => ({ ...el, id: uid() })) };
}

/** Every font family the templates use, to load before drawing thumbnails. */
export const TEMPLATE_FONTS: string[] = [...new Set(CATEGORIES.flatMap((c) => [c.font, c.bodyFont]).concat(KINDS.flatMap((k) => (k.font ? [k.font] : []))))];

export interface TemplateFilter {
  query?: string;
  category?: string | null;
  size?: LabelSize | null;
}

export function filterTemplates(list: Template[], { query = '', category = null, size = null }: TemplateFilter): Template[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(
    (t) =>
      (!category || t.category === category) &&
      (!size || (t.size.widthMm === size.widthMm && t.size.heightMm === size.heightMm)) &&
      words.every((w) => t.haystack.includes(w)),
  );
}
