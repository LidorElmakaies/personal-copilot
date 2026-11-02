import { OCTOBER_ENTRIES, TODAY } from '../mocks';
import EntryRow from './EntryRow';

const today = OCTOBER_ENTRIES.filter((e) => e.occurredOn === TODAY);
const groceries = today.find((e) => e.description === 'Weekly groceries');

export default {
  component: EntryRow,
  parameters: { language: 'en' },
  args: { entry: groceries, category: 'Groceries' },
  argTypes: { onPress: { action: 'pressed' } },
};

// 2 photos, matched by the statement.
export const PhotosAndMatched = {};
export const NotSent = {
  args: {
    entry: today.find((e) => e.notSent),
    category: 'Eating out',
  },
};
export const Plain = {
  args: {
    entry: OCTOBER_ENTRIES.find((e) => e.paidWith === 'cash'),
    category: 'Eating out',
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
// The user's text in either language or both, whatever the app's: each in its own direction.
export const MixedInEnglish = {
  args: {
    entry: { ...groceries, description: 'Shelves לחדר העבודה' },
    category: 'מתנות',
  },
};
export const MixedInHebrew = {
  parameters: { language: 'he' },
  args: {
    entry: { ...groceries, description: 'Coffee וכריך' },
    category: 'Eating out',
  },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: {
    entry: { ...groceries, description: 'קניות שבועיות בשופרסל דיל' },
    category: 'סופר',
  },
};
