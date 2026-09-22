# Design vision — glass shell

Not implemented yet. This is the target design for the frontend's next visual era, replacing the
current space/glow/gradient look (see [README.md](README.md) — that look was always flagged as a
stepping-stone). Kept as its own file rather than folded into `README.md` so it doesn't get
mistaken for what's actually built today.

This file replaces an earlier draft of itself — a "cyber hub" concept (glowing nodes on a canvas
you travel between, later a spaceship corridor, later a real 3D alien-hull scene) that was fully
prototyped and then deliberately dropped in favor of what's below. See "Explored and rejected" at
the bottom before proposing any of that again.

A working prototype of everything in this file lives at `design-lab/` (repo root, sibling to this
folder) — throwaway HTML/CSS/JS, not real code, not tracked, but it is the source of truth for
exact look/feel/timing until this gets built for real. `cd design-lab && npm install && npm run
dev`, open `localhost:5173`.

## The idea

An ordinary app shell — top bar, bottom tab bar, cards — not a spatial metaphor. What keeps it from
being boring: every surface is frosted glass, the whole screen re-skins live between a dark and a
light theme, and the background drifts on its own (soft, slowly breathing color washes) without
ever competing with the content sitting on top of it. Clean and legible first; "alive" is a
background detail, not the headline.

## Navigation

- **Top bar** — current page title + a small connection-status dot (real data: gateway/socket
  state, not decorative).
- **Bottom tab bar** — the primary nav, one destination per tab (Settings today; User Management /
  Admin Panel / Agent Panel join it as those get built). Icon + label per tab, simple stroke-based
  line icons (not emoji, not filled/solid icons) — see `design-lab/index.html`'s inline SVGs for
  the exact set (sliders / person / shield / chip). Active tab: icon switches to the accent color
  and gets a soft outer glow; inactive tabs stay in `text-faint`.
- **Content transitions** — switching tabs is a plain ~180ms fade + slight rise on the incoming
  panel. No travel, no zoom, no scene to move through.
- **Side drawer** — built and working in the lab (`#drawer-frame`, hidden behind a disclosure
  toggle) as a documented fallback, not the active pattern. Revisit only if the tab bar runs out of
  room for more destinations than four-ish icons comfortably hold.
- **Top segmented control** — prototyped, compared side-by-side with the tab bar, not chosen.
  Removed from the lab; don't re-propose without a specific reason the tab bar stopped working.

## Theme — dark and light, both fully live

Not a palette that only theoretically supports light mode — the lab's theme switch actually
re-skins the whole screen on tap, and every component below was checked in both states. The bug
that shipped once and got caught: `.btn--glass`'s original translucent-white treatment was
invisible on a light background (white-on-near-white) because the button wasn't reading the
frame's live theme tokens at all. Any new component must consume the same tokens, not hardcode a
dark-mode-only color.

| Token | Dark | Light |
|---|---|---|
| Background | `#0a0c0f` | `#eef1f4` |
| Panel / surface | `#12151a` | `#ffffff` |
| Text | `#e8ecf0` | `#1b1f24` |
| Text, dim | `#8b939e` | `#5b6570` |
| Text, faint | `#525a63` | `#93a0aa` |
| Border | `rgba(255,255,255,.12)` | `rgba(20,30,40,.12)` |
| Accent | `#4fe3ff` (bright cyan — glows well on near-black) | `#0e8fa6` (deeper teal — holds contrast on white) |

Semantic colors (status chips, alerts) stay the same hex across both themes — tuned to hold
readable contrast on both a near-black and a near-white surface rather than getting a separate
light-mode variant: online/success `#12a866`, pending `#c9791a`, danger `#a4271e`
(`#ff9d8f`/`rgba(255,107,91,…)` on dark surfaces reads better with a brighter danger tone — see the
lab's `.btn--glass-danger` rule for the exact dark/light split).

Glass itself is not a naive color invert between themes:

- **Dark**: translucent *white* over the surface — `linear-gradient(160deg, rgba(255,255,255,.08),
  rgba(255,255,255,.02))`, light border, glow-colored shadow.
- **Light**: translucent *dark* (charcoal) over the surface — `rgba(20,30,40,.07)` down to `.02`,
  a darker border, a soft neutral drop-shadow instead of a neon glow (a colored glow reads as messy
  on white; a plain soft shadow reads as "elevated," which is the actual goal).

## Components

- **Glass Card** — the standard container for grouped content (`.card` in the lab): translucent
  blurred surface (`backdrop-filter: blur(10px)`), soft accent-colored glow shadow in dark mode /
  soft neutral shadow in light mode. This was the explicitly confirmed pick over three other node
  styles that were prototyped (console-panel, gauge-tile, radial-node) — those stay in the lab as
  reference for denser data display (e.g. a future detail screen) but aren't the default.
- **Row** — title + subtitle stack, optional trailing chip or control, used inside a card,
  bottom-border-separated from the next row.
- **Chip** — small pill badge, semantic color only (online/pending/etc.), never used for anything
  that isn't a real status.
- **Switch** — the theme toggle's shape, reusable for any boolean setting: track + sliding knob,
  knob picks up the accent color + glow when on.
- **Stat tile** — big monospace number (`font-variant-numeric: tabular-nums`) + small caption label,
  for dashboard-style metrics (e.g. Admin's user/pending/admin counts).
- **Buttons** — **Glass is the one button**, confirmed pick over three other styles prototyped (HUD
  bracket, console toggle, hard alert-border). Every action button uses the glass family; semantic
  differentiation (e.g. Log Out) is a color modifier on glass (`.btn--glass-danger`: red-tinted
  border/text/glow), never a different button shape. The other three styles stay in the lab's
  Buttons tab as rejected reference, not options to mix back in.

## Background / ambient motion

One layer, strictly decorative — legibility of whatever's on top always wins. Already built for
real (`src/components/AmbientBackground.js`), ahead of the rest of this file — it runs behind the
app's current space/glow/gradient screens too, not just the future glass shell.

3 soft radial-gradient "wash" layers per theme (`src/theme/colors.js`'s `dark`/`light` `wash`
arrays — cyan/violet/pink for dark's "space" set, gold/coral for light's "sun" set), each
independently drifting (translate + scale) and breathing in opacity on its own slow loop (13–19s
per layer, eased). Rendered as `react-native-svg` `<RadialGradient>`s, animated with plain React
Native `Animated` (`useNativeDriver: true`) rather than a canvas — the platform composites a few
flat gradient transforms instead of anything being redrawn in JS every frame.

Must fully stop under `prefers-reduced-motion: reduce` — the RN implementation gates this with
Reanimated's `useReducedMotion()` hook: when true, the drift/breathe `Animated.loop` simply never
starts, leaving the washes static at rest. Should never be the first thing the eye goes to.

## Typography

Keeps the pairing already established in `src/theme/`, not a new choice:

- **UI / headings** — Rajdhani, falls back to Inter.
- **Body** — Inter.
- **Mono / data** — JetBrains Mono, for status text, chip labels, and anywhere digits need to line
  up (`tabular-nums`).

Four alternate display-face pairings were explored for a more distinctive heading font (Orbitron +
Exo 2, Chakra Petch + Inter, Share Tech Mono + IBM Plex Sans, Audiowide + Rajdhani — still visible
in the lab's Typography tab) but none were picked. Open question, not a blocker — revisit only if
Rajdhani starts feeling generic once real content is in place.

## Mapping to the real stack

The lab is disposable HTML standing in for fidelity, not a port target — `design-lab/index.html`
uses plain CSS/canvas tricks that don't map 1:1 onto React Native. Real build:

| Lab concept | Real implementation |
|---|---|
| `.card` / Glass Card | Restyle of `GlowCard` (`src/components/`) — same glass token logic, theme-aware per the table above |
| `.btn--glass` / `.btn--glass-danger` | Restyle of `GradientButton` — glass instead of gradient fill, `variant="danger"` prop for the tint |
| Bottom tab bar | New component — Expo Router `(tabs)` already provides the routing; this is the visual chrome around it |
| Ambient wash background | Already built — `AmbientBackground.js` (`react-native-svg` `<RadialGradient>` + RN `Animated`, replaced `SpaceBackground` directly) — no further porting needed for this row |
| Theme switch | Already exists (`themeSlice`, `useAppTheme()`, `ThemeAnimContext`) — this design doesn't change the pipeline, only what it themes |
| Tab-switch fade | `react-native-reanimated` `entering`/`exiting` (or `moti`) on the focused screen, ~180ms |
| Stat tile, Chip, Switch, Row | New components — none of these exist in `src/components/` yet |

`react-native-gesture-handler` and `moti` stay in `package.json` from the earlier draft; gesture
handling has no role in this design (nothing to pan/pinch), keep the dependency only if `moti` ends
up used for enter/exit, drop it otherwise.

## Explored and rejected

Recorded so none of this gets re-proposed from scratch:

- **Cyber hub** — a canvas of glowing nodes you travel between like a game's skill tree/overworld.
- **Spaceship corridor** — a bright, red-trimmed ship interior (2.5D CSS clip-path tunnel, then a
  real WebGL 3D tunnel via three.js) you fly/walk down, with room-to-room travel transitions and
  panels that open a themed console.
- **Alien hull** — a bio-mechanical, violet/teal-bioluminescent version of the above, with a
  "human tech bolted onto alien ship" contrast (dark-green terminal consoles against the organic
  hull).
- **Particle-field backgrounds as the primary background system** — four canvas particle modes
  (drifting dust, circuit traces, scanline grid, signal static) explored as the main "living
  background." Superseded by the wash-layer system above, which reads as ambient polish rather than
  the point of the screen.
- **Skia-drawn blobs + randomized sparkle spawner** — an earlier real (not lab-only)
  implementation of the ambient background: 2–5 blurred Skia "blob" circles plus up to 70
  randomly-spawned sparkle particles on a Skia `<Canvas>`. Dropped because animating ~80
  individually-positioned Skia draw calls repainted the entire WASM canvas every frame, pegging CPU
  and growing memory to ~1GB on web; the Skia render loop also didn't resume cleanly after a
  backgrounded browser tab regained focus. Replaced by the flat `react-native-svg` + RN `Animated`
  wash layers described above.
- **Top segmented control** for primary nav — built, compared directly against the bottom tab bar,
  not chosen.

## Explicitly not doing

- No `@react-three/fiber`/`expo-three`, no literal 3D — settled twice now (once in the original
  draft, once after actually building and discarding a three.js prototype).
- No spatial/travel navigation metaphor of any kind.
- No sound design commitment.
- No panel content changes — this file is about the shell (background, navigation, transitions,
  theme, shared components), not what Settings/User Management/Admin Panel/Agent Panel each contain
  beyond the placeholder content already sketched in `design-lab/index.html`.
