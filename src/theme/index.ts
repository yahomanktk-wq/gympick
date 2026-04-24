// ─── GymPick Design System ────────────────────────────────────────────────────

export const C = {
  // Backgrounds — three-level depth
  bg:          '#0a0a0c',   // deepest layer (screen bg)
  surface:     '#131316',   // cards, sheets
  surfaceHigh: '#1c1c22',   // inner rows, inputs

  // Borders
  border:      '#252530',
  borderSub:   '#1a1a24',

  // Accent — neon lime
  accent:      '#c8ff57',
  accentDim:   '#8cb83a',
  accentBg:    '#c8ff5715',   // translucent accent fill

  // Semantic
  danger:      '#ff4d4d',
  dangerBg:    '#ff4d4d18',
  warning:     '#ffb547',

  // Text
  text:        '#ffffff',
  textSub:     '#7a7a8c',
  textDim:     '#3a3a4a',

  // Tag palette (for filter chips / pills)
  tagMachine:  { fg: '#5ba4ff', bg: '#5ba4ff18' },
  tagBrand:    { fg: '#b36bff', bg: '#b36bff18' },
  tagMuscle:   { fg: '#ff7c47', bg: '#ff7c4718' },
  tagCategory: { fg: '#3dd68c', bg: '#3dd68c18' },
} as const;

export const R = {
  card:   20,
  inner:  12,
  pill:   100,
  btn:    16,
} as const;

export const T = {
  giant:   { fontSize: 56, fontWeight: '900', letterSpacing: -2 } as const,
  hero:    { fontSize: 36, fontWeight: '900', letterSpacing: -1.5 } as const,
  title:   { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 } as const,
  section: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 } as const,
  body:    { fontSize: 15, fontWeight: '400' } as const,
  label:   { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 } as const,
  micro:   { fontSize: 10, fontWeight: '700', letterSpacing: 1 } as const,
} as const;
