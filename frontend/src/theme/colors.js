// Read via useAppTheme() — never imported directly in a screen/component, see
// .claude/agents/frontend.md. "Glass" wash direction (white in dark mode, charcoal in light)
// follows DESIGN.md's Theme section; GlowCard/GradientButton pick it themselves.

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
  // Kept lighter than the muted tone below — needs to stay legible for a Row subtitle against
  // the near-black bg (#0a0c0f).
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
  // Per-particle palette (Stars.js/Meteors.js) — a single flat white reads duller than real
  // starlight, which varies blue-white to gold.
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
  // GradientButton.js's fill/rim/sweep — translucent white wash (see top-of-file comment).
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
  // Kept darker than a straight muted tone — needs to stay legible for a Row subtitle against
  // the near-white bg (#eef1f4).
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
  // Darker/more saturated than the dark-mode set — needs real contrast against a near-white bg or
  // it vanishes (Stars.js/Meteors.js's higher light-mode opacity is the other half of that fix).
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
  // Inverted wash direction (see top-of-file comment); sweep kept dimmer since a bright white
  // streak reads harsh on a light surface.
  buttonFillStart: 'rgba(20,30,40,0.07)',
  buttonFillEnd: 'rgba(20,30,40,0.02)',
  buttonRim: 'rgba(20,30,40,0.18)',
  buttonSweep: 'rgba(255,255,255,0.22)',
};
