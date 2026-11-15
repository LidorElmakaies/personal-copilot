import QuickAddSheet from './QuickAddSheet';

export default {
  component: QuickAddSheet,
  parameters: { language: 'en' },
  args: { visible: true },
  argTypes: { onClose: { action: 'closed' } },
};

// The title, the amount (the keyboard opens) and what it was for until U5.4.
export const Empty = {};
export const Hebrew = { parameters: { language: 'he' } };
