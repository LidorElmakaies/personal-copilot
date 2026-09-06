# frontend

Expo/React Native app — login/register + a Settings tab. See the root
[CLAUDE.md](../CLAUDE.md) for architecture, [.claude/agents/frontend.md](../.claude/agents/frontend.md)
for the conventions to follow when changing anything here.

```bash
npm install
cp .env.example .env    # sets EXPO_PUBLIC_GATEWAY_ORIGIN — required, no fallback
npx expo start          # Expo Go / dev client
npx expo start --web
```

Matches the sibling project it's modeled on (`ask-my-crawl`) for theme/component conventions — the
same three-layer theme pipeline (`themeSlice` → `useAppTheme()` → `ThemeAnimContext`, 600ms
transitions) and the same shared components (`GlowCard`, `GradientButton`, `InputField`,
`SpaceBackground`), minus the Gluestack layer underneath `ask-my-crawl`'s own pipeline — nothing
here renders an actual Gluestack component, so it wasn't carried over. The current look
(space/glow/gradient) is a known stepping-stone, expected to be replaced by a different, more
animated style later — keep it internally consistent until then rather than treating it as a fixed
brand.

Same Redux Toolkit + services-layer + Expo Router conventions otherwise: all I/O lives in
`src/services/`, split by transport — `services/http/` (fetch-based calls) and `services/ws/` (the
Socket.IO client) — called only from thunks in `src/store/slices/`, never inline in a component.
