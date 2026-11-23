import { OCTOBER_ENTRIES, TODAY } from '../mocks';
import EntryRow from './EntryRow';

const today = OCTOBER_ENTRIES.filter((e) => e.occurredOn === TODAY);
const groceries = today.find((e) => e.description === 'Weekly groceries');

export default {
  component: EntryRow,
  parameters: { language: 'en' },
  args: { entry: groceries, categories: ['Groceries'] },
  argTypes: { onPress: { action: 'pressed' } },
};

// 2 photos, matched by the statement.
export const PhotosAndMatched = {};
export const NotSent = {
  args: {
    entry: today.find((e) => e.notSent),
    categories: ['Eating out'],
  },
};
export const Plain = {
  args: {
    entry: OCTOBER_ENTRIES.find((e) => e.paidWith === 'cash'),
    categories: ['Eating out'],
  },
};
export const LongText = {
  args: {
    entry: {
      ...groceries,
      description: 'Groceries and cleaning stuff for the week', // 40 characters
    },
  },
};
export const Received = {
  args: {
    entry: {
      ...groceries,
      description: 'Sold a bookshelf',
      direction: 'income',
      paidWith: 'bit',
      cardLast4: null,
      attachmentIds: [],
      statementLine: null,
    },
    categories: [],
  },
};
export const TwoCategories = {
  args: { categories: ['Groceries', 'מתנות'] },
};
// Past two they're counted: "3 categories".
export const ThreeCategories = {
  args: { categories: ['Groceries', 'מתנות', 'Shopping'] },
};
export const TwoCategoriesHebrew = {
  parameters: { language: 'he' },
  args: { categories: ['Groceries', 'מתנות'] },
};
// The user's text in either language or both, whatever the app's: each in its own direction.
export const MixedInEnglish = {
  args: {
    entry: { ...groceries, description: 'Shelves לחדר העבודה' },
    categories: ['מתנות'],
  },
};
export const MixedInHebrew = {
  parameters: { language: 'he' },
  args: {
    entry: { ...groceries, description: 'Coffee וכריך' },
    categories: ['Eating out'],
  },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: {
    entry: { ...groceries, description: 'קניות שבועיות בשופרסל דיל' },
    categories: ['סופר'],
  },
};
