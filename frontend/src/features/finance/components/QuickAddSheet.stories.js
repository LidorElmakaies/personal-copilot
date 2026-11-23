import { CARDS, CATEGORIES, TODAY } from '../mocks';
import QuickAddSheet from './QuickAddSheet';

export default {
  component: QuickAddSheet,
  parameters: { language: 'en' },
  args: {
    visible: true,
    categories: CATEGORIES,
    cards: CARDS,
    today: TODAY,
  },
  argTypes: { onClose: { action: 'closed' } },
};

// The amount (the keyboard opens), what it was for, the categories, paid with and Save, above the keyboard.
export const Empty = {};
// More than fits once "More…" is opened: the body scrolls.
export const ManyCategories = {
  args: {
    categories: [
      ...CATEGORIES,
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `cat-extra-${i}`,
        name: `Category ${String.fromCharCode(65 + (i % 26))}`,
      })),
    ],
  },
};
export const Hebrew = { parameters: { language: 'he' } };
