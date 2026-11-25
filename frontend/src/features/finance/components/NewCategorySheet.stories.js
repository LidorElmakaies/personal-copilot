import { CATEGORIES } from '../mocks';
import NewCategorySheet from './NewCategorySheet';

export default {
  component: NewCategorySheet,
  parameters: { language: 'en' },
  args: { visible: true, categories: CATEGORIES },
  argTypes: {
    onClose: { action: 'closed' },
    onSave: { action: 'saved' },
  },
};

// Screen 14: type "Coffee" — Add lights up; "groceries" or "תחבורה" says it's taken; "Café 2" keeps
// only its letters.
export const Default = {};
export const Hebrew = { parameters: { language: 'he' } };
// Screen 24.
const editing = { category: CATEGORIES[2], onArchive: () => {} };
export const Edit = { args: editing };
export const EditTheLast = { args: { category: CATEGORIES[2] } };
export const HebrewEdit = { parameters: { language: 'he' }, args: editing };
