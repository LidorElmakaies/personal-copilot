import QuickAddSheet from './QuickAddSheet';

export default {
  component: QuickAddSheet,
  parameters: { language: 'en' },
  args: { visible: true },
  argTypes: { onClose: { action: 'closed' } },
};

// Only the title until U5.
export const Empty = {};
export const Hebrew = { parameters: { language: 'he' } };
