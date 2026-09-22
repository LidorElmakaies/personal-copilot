# Bridge Console — style lab

Throwaway HTML/CSS/JS playground for personal-copilot's next frontend direction (see
`../frontend/DESIGN.md`). Nothing here ships — it exists to pick a look before it gets built for
real in Skia/Reanimated/Moti. Not tracked as part of the app; delete this whole folder whenever
you're done with it.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:5173 in your normal browser.

Don't have/want npm deps for a throwaway folder? Skip `package.json` entirely:

```
npx serve .
```

Either way, run it as a real local page — **not** through the Claude artifact preview. That
preview renders inside a sandboxed iframe that appears to block WebGL entirely (the 3D tab shows
"3D unavailable" there); a normal browser tab has no such restriction.

## What's here

One page (`index.html`), four tabs:

- **Flow** — the main event: a real three.js WebGL scene. An organic, asymmetric alien tunnel
  (procedurally built — no model files, just a bending curve + noise-perturbed cross-section),
  bioluminescent violet/teal rib lights, drifting spore particles. Drag inside the frame to look
  around, tap a glowing pod embedded in the hull to fly the camera to it and open its console — the
  one place the alien bioluminescence gives way to a human green CRT terminal.
- **Buttons** — HUD bracket / console toggle / glass panel / alert. Glass panel is marked as your
  pick.
- **Nodes & Panels** — four card families (console / gauge / glass / radial), each shown
  active/locked/alert. Glass card is marked as your pick.
- **Typography** — four type pairings on the same copy, with a replayable terminal-reveal effect.

Everything is plain HTML/CSS/JS — three.js loads from a CDN, the rest is hand-written, no build
step, no bundler. Edit `index.html` directly and refresh to iterate.
