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
  // Lightened from #525a63 — that was barely distinguishable from the near-black bg (#0a0c0f),
  // making a Row's subtitle (theme mode, account email, "Socket.IO · /ws") hard to read.
  textFaint: '#7d8792',
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
  spaceGradient: ['#0a0c0f', '#0d0f1c', '#0a0c0f'],
  // Picked from per particle (Stars.js/Meteors.js) — real starlight varies from blue-white to
  // gold depending on temperature, so a single flat white read as duller than intended.
  particleColors: [
    '#ffffff',
    '#bfe9ff',
    '#d8c7ff',
    '#ffe3ad',
    '#ffc9e8',
    '#c8ffe0',
    '#ffb8a8',
    '#a8fff0',
    '#c8d4ff',
  ],
  // GradientButton.js's resting diagonal gradient fill, top-edge highlight rim, and hover sweep
  // streak — a translucent white wash in dark mode (see this file's own "Glass" comment above).
  buttonFillStart: 'rgba(255,255,255,0.08)',
  buttonFillEnd: 'rgba(255,255,255,0.02)',
  buttonRim: 'rgba(255,255,255,0.3)',
  buttonSweep: 'rgba(255,255,255,0.4)',
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
  // Darkened from #93a0aa — that was too washed-out against the near-white bg (#eef1f4), making
  // a Row's subtitle (theme mode, account email, "Socket.IO · /ws") hard to read.
  textFaint: '#6b7680',
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
  spaceGradient: ['#eef1f4', '#eaf0f6', '#eef1f4'],
  // Darker/more saturated than the dark-mode set on purpose — these need real contrast against
  // a near-white bg, not just a tint of it, or they vanish (see Stars.js/Meteors.js's higher
  // light-mode opacity for the other half of that fix).
  particleColors: [
    '#3a424a',
    '#0b6f81',
    '#5f3fa0',
    '#8f6608',
    '#8f3f5c',
    '#1f7a4d',
    '#a8501f',
    '#0f6b6b',
    '#4a4a9e',
  ],
  // Translucent charcoal wash, not white — light mode inverts the wash direction (see this
  // file's own "Glass" comment above), and the sweep is dimmer since a bright white streak reads
  // harsh on a light surface.
  buttonFillStart: 'rgba(20,30,40,0.07)',
  buttonFillEnd: 'rgba(20,30,40,0.02)',
  buttonRim: 'rgba(20,30,40,0.18)',
  buttonSweep: 'rgba(255,255,255,0.22)',
};
