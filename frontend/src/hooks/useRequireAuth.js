import { useSelector } from 'react-redux';

// Mount-time half of requiresAuth gating (the tab-press half lives in (tabs)/_layout.js) — see
// .claude/agents/frontend.md's "Where you work" section for why both halves exist.
export function useRequireAuth() {
  return useSelector((state) => !!state.auth.accessToken);
}
