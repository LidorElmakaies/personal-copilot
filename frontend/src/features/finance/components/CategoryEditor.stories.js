import { useState } from 'react';
import { CATEGORIES } from '../mocks';
import { archiveCategory } from '../utils/categories';
import CategoryEditor from './CategoryEditor';

// Changed here only.
const Editor = ({ initial }) => {
  const [categories, setCategories] = useState(initial);
  return <CategoryEditor categories={categories} onChange={setCategories} />;
};

const AT = '2026-10-27T18:00:00.000Z';
const withArchived = archiveCategory(CATEGORIES, 'cat-gifts', AT);
// Its name is taken by an active one: Restore says so.
const withTaken = [
  ...withArchived,
  { ...CATEGORIES[1], id: 'cat-old', archivedAt: AT },
];

export default {
  component: CategoryEditor,
  parameters: { language: 'en' },
  render: (args) => <Editor {...args} />,
  args: { initial: CATEGORIES },
};

export const NoneArchived = {};
export const OneArchived = { args: { initial: withArchived } };
export const RestoreTaken = { args: { initial: withTaken } };
// Can't be archived.
export const OnlyOne = { args: { initial: CATEGORIES.slice(0, 1) } };
export const LongName = {
  args: {
    initial: [
      { ...CATEGORIES[0], name: 'Kids and after-school classes' },
      ...CATEGORIES.slice(1),
    ],
  },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: { initial: withArchived },
};
