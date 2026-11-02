import { RequireAuthNotice } from '../../account';
import FinanceScreen from './FinanceScreen';

export default {
  component: FinanceScreen,
  parameters: { layout: 'fullscreen', language: 'en' },
};

// October 2026; ‹ goes to empty months.
export const Default = {};
export const Hebrew = { parameters: { language: 'he' } };

// Screen 9 — what the tab shows logged out, once login is live (B1).
export const LoggedOut = {
  render: () => (
    <RequireAuthNotice
      title="Finance"
      message="Your entries and receipts are kept on your PC, so they survive reinstalling the app. Log in to use them."
    />
  ),
};
