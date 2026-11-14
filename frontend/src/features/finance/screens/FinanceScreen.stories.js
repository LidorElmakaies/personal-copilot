import { RequireAuthNotice } from '../../account';
import FinanceScreen from './FinanceScreen';

export default {
  component: FinanceScreen,
  parameters: { layout: 'fullscreen', language: 'en' },
};

// October 2026 as on screen 1: the statement's banner, "1 entry waiting", SpentCard, the
// entries, the +; ‹ goes to empty months (no banner there).
export const Default = {};
export const Hebrew = { parameters: { language: 'he' } };
// The PC out of reach: the notice says you can still add.
export const Unreachable = { args: { reachable: false } };
export const HebrewUnreachable = {
  parameters: { language: 'he' },
  args: { reachable: false },
};

// Screen 9 — what the tab shows logged out, once login is live (B1).
export const LoggedOut = {
  render: () => (
    <RequireAuthNotice
      title="Finance"
      message="Your entries and receipts are kept on your PC, so they survive reinstalling the app. Log in to use them."
    />
  ),
};
