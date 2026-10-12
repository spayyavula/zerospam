// Reading Room palette — mirrors the CSS variables in web/src/styles.css so the app and
// webmail read as the same product.

export type Palette = {
  paper: string;
  paperDeep: string;
  ink: string;
  inkSoft: string;
  quiet: string;
  rule: string;
  ruleStrong: string;
  signal: string;
  /** Text drawn on a signal-yellow fill. Dark in both themes. */
  onSignal: string;
  /** Accent text on paper (links, active labels). */
  accent: string;
  danger: string;
  ok: string;
  overlay: string;
};

export const light: Palette = {
  paper: '#FBF8F1',
  paperDeep: '#F5EFE3',
  ink: '#0A0A0A',
  inkSoft: '#2A2A2A',
  quiet: '#6B6863',
  rule: '#E8E1D2',
  ruleStrong: '#1F1F1F',
  signal: '#FFD52E',
  onSignal: '#14120B',
  accent: '#7A5C00',
  danger: '#C62828',
  ok: '#1E7A3C',
  overlay: 'rgba(10,10,10,0.4)',
};

export const dark: Palette = {
  paper: '#0E0E0C',
  paperDeep: '#16160F',
  ink: '#F3EFE4',
  inkSoft: '#CFC9BC',
  quiet: '#9A958A',
  rule: '#2A2A26',
  ruleStrong: '#F3EFE4',
  signal: '#FFD52E',
  onSignal: '#14120B',
  accent: '#FFD52E',
  danger: '#FF6B81',
  ok: '#7FE0A1',
  overlay: 'rgba(0,0,0,0.6)',
};

export const fonts = {
  /** Source Serif 4, loaded in App.tsx. Falls back to the platform serif until loaded. */
  display: 'SourceSerif4_600SemiBold',
  displayItalic: 'SourceSerif4_400Regular_Italic',
  mono: 'monospace',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 14, pill: 999 } as const;
