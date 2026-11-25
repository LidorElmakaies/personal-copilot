import {
  CARDS,
  CATEGORIES,
  EXAMPLE_PHOTOS,
  OCTOBER_ENTRIES,
  pickExamplePhotos,
  STATEMENT_LINES,
  TODAY,
} from '../mocks';
import QuickAddSheet from './QuickAddSheet';

export default {
  component: QuickAddSheet,
  parameters: { language: 'en' },
  args: {
    visible: true,
    categories: CATEGORIES,
    cards: CARDS,
    today: TODAY,
    pickPhotos: pickExamplePhotos,
  },
  argTypes: { onClose: { action: 'closed' }, onSave: { action: 'saved' } },
};

// The amount (the keyboard opens), what it was for, the categories, paid with, the photos and Save, above the keyboard.
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
// Screen 7: a statement's charge.
const answering = {
  charge: {
    line: STATEMENT_LINES.find((l) => l.amountAgorot === 8000),
    cardLast4: '4821',
    n: 1,
    total: 5,
  },
};
export const Answer = { args: answering };
export const AnswerLast = {
  args: { charge: { ...answering.charge, n: 5 } },
};
export const HebrewAnswer = {
  parameters: { language: 'he' },
  args: answering,
};
// Edit: filled in, the keyboard closed.
const editing = {
  entry: OCTOBER_ENTRIES.find((e) => e.description === 'Fuel'),
  entryPhotos: EXAMPLE_PHOTOS.slice(2, 4),
};
export const Editing = { args: editing };
export const EditingReceived = {
  args: {
    entry: {
      ...editing.entry,
      description: 'Sold a bookshelf',
      direction: 'income',
      paidWith: 'paybox',
      cardLast4: null,
    },
  },
};
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewEditing = {
  parameters: { language: 'he' },
  args: editing,
};
