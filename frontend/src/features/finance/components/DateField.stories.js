import { TODAY } from '../mocks';
import DateField from './DateField';

export default {
  component: DateField,
  parameters: { language: 'en' },
  args: { value: TODAY, today: TODAY },
  argTypes: { onPress: { action: 'pressed' } },
};

export const Today = {};
export const Yesterday = { args: { value: '2026-10-26' } };
export const AnotherDay = { args: { value: '2026-10-12' } };
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewAnotherDay = {
  parameters: { language: 'he' },
  args: { value: '2026-10-12' },
};
