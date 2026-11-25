import { useState } from 'react';
import { CATEGORIES } from '../mocks';
import CategoryChips from './CategoryChips';

export default {
  component: CategoryChips,
  parameters: { language: 'en' },
};

// Picking changes it here only.
const Chips = ({ selected = null, categories = CATEGORIES, ...props }) => {
  const [id, setId] = useState(selected);
  return (
    <CategoryChips
      {...props}
      categories={categories}
      selectedId={id}
      onChange={setId}
    />
  );
};

export const NoneChosen = { render: () => <Chips /> };
// As drawn.
export const OneChosen = {
  render: () => <Chips selected="cat-eating-out" />,
};
// The last category: shows before "More…" too.
export const ChosenBehindMore = {
  render: () => <Chips selected="cat-other" />,
};
export const Opened = {
  render: () => <Chips selected="cat-bills" defaultOpen />,
};
// No "More…".
export const FewCategories = {
  render: () => <Chips categories={CATEGORIES.slice(0, 4)} />,
};
export const LongName = {
  render: () => (
    <Chips
      categories={[
        { id: 'cat-x', name: 'Kids, school trips and after-school classes' },
        ...CATEGORIES,
      ]}
      selected="cat-x"
    />
  ),
};
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Chips selected="cat-transport" />,
};
