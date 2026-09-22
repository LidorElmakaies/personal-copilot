// Static color definitions — the single source of truth for all colors.
// Import this file directly anywhere you need raw values (StyleSheet, animations, etc.)
// useAppTheme() uses this to return the correct palette at runtime.
//
// "Glass" palette — see ../../DESIGN.md. Glass is not a naive light/dark invert: dark mode washes
// translucent white over a surface, light mode washes translucent dark (charcoal) over it — see
// GlowCard/GradientButton, which pick the wash direction themselves rather than reading a single
// "glass color" token.

export const dark = {
  bg: '#0a0c0f',
  panel: '#12151a',
  card: 'rgba(255,255,255,0.07)',
  cardBorder: 'rgba(255,255,255,0.14)',
  cardBorderSoft: 'rgba(255,255,255,0.08)',
  primary: '#4fe3ff',
  accent: '#4fe3ff',
  text: '#e8ecf0',
  textMuted: '#8b939e',
  textFaint: '#525a63',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.14)',
  inputFocusBorder: '#4fe3ff',
  tabBar: 'rgba(18,21,26,0.82)',
  tabBarBorder: 'rgba(255,255,255,0.08)',
  activeTab: '#4fe3ff',
  inactiveTab: '#525a63',
  success: '#3ddc84',
  successBg: 'rgba(61,220,132,0.14)',
  pending: '#ffb84f',
  pendingBg: 'rgba(255,184,79,0.14)',
  error: '#ff6b5b',
  errorBg: 'rgba(255,107,91,0.12)',
  errorBorder: 'rgba(255,107,91,0.4)',
  shadow: '#4fe3ff',
  onPrimary: '#04141a',
};

export const light = {
  bg: '#eef1f4',
  panel: '#ffffff',
  card: 'rgba(20,30,40,0.06)',
  cardBorder: 'rgba(20,30,40,0.14)',
  cardBorderSoft: 'rgba(20,30,40,0.08)',
  primary: '#0e8fa6',
  accent: '#0e8fa6',
  text: '#1b1f24',
  textMuted: '#5b6570',
  textFaint: '#93a0aa',
  inputBg: 'rgba(20,30,40,0.03)',
  inputBorder: 'rgba(20,30,40,0.16)',
  inputFocusBorder: '#0e8fa6',
  tabBar: 'rgba(255,255,255,0.82)',
  tabBarBorder: 'rgba(20,30,40,0.08)',
  activeTab: '#0e8fa6',
  inactiveTab: '#93a0aa',
  success: '#12a866',
  successBg: 'rgba(18,168,102,0.12)',
  pending: '#c9791a',
  pendingBg: 'rgba(201,121,26,0.12)',
  error: '#a4271e',
  errorBg: 'rgba(164,39,30,0.08)',
  errorBorder: 'rgba(164,39,30,0.35)',
  shadow: '#0e8fa6',
  onPrimary: '#ffffff',
};
