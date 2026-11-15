import { CATEGORIES } from '../mocks';
import NewCategorySheet from './NewCategorySheet';

export default {
  component: NewCategorySheet,
  parameters: { language: 'en' },
  args: { visible: true, categories: CATEGORIES },
  argTypes: {
    onClose: { action: 'closed' },
    onAdd: { action: 'added' },
  },
};

// Screen 14: type "Coffee" — Add lights up; "groceries" or "תחבורה" says it's taken; "Café 2" keeps
// only its letters.
export const Default = {};
export const Hebrew = { parameters: { language: 'he' } };
