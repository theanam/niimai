/**
 * Paper types, as niimbluelib's LabelType numbers. The printer uses this to
 * find the start of each label, so the wrong one mis-feeds the roll.
 */
export type PaperType = 'gaps' | 'blackmark' | 'continuous' | 'perforated' | 'transparent';

export const PAPER_TYPES: { value: PaperType; label: string; labelType: number }[] = [
  { value: 'gaps', label: 'Labels with gaps', labelType: 1 },
  { value: 'blackmark', label: 'Black mark', labelType: 2 },
  { value: 'continuous', label: 'Continuous', labelType: 3 },
  { value: 'perforated', label: 'Perforated', labelType: 4 },
  { value: 'transparent', label: 'Transparent', labelType: 5 },
];

export const paperFromLabelType = (n: number | undefined): PaperType | undefined => PAPER_TYPES.find((p) => p.labelType === n)?.value;

export const labelTypeOf = (p: PaperType): number => PAPER_TYPES.find((x) => x.value === p)!.labelType;

export const paperName = (p: PaperType): string => PAPER_TYPES.find((x) => x.value === p)!.label;

/** The paper to print on: the label's own choice, then what the roll reports, then labels with gaps. */
export const effectivePaper = (chosen: PaperType | undefined, fromRoll: PaperType | undefined): PaperType => chosen ?? fromRoll ?? 'gaps';
