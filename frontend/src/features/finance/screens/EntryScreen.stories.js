import { OCTOBER_ENTRIES, TODAY } from '../mocks';
import EntryScreen from './EntryScreen';

export default {
  component: EntryScreen,
  parameters: { layout: 'fullscreen', language: 'en' },
  args: {
    id: OCTOBER_ENTRIES.find(
      (e) => e.description === 'Weekly groceries' && e.occurredOn === TODAY,
    ).id,
  },
};

export const Default = {};
export const Hebrew = { parameters: { language: 'he' } };
export const Unknown = { args: { id: 'gone' } };
