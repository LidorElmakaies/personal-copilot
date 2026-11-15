import FilterChip from './FilterChip';

export default {
  component: FilterChip,
  parameters: { language: 'en' },
  args: { label: 'Groceries' },
  argTypes: { onPress: { action: 'pressed' } },
};

export const Off = {};
export const On = { args: { on: true } };
export const WithIcon = { args: { icon: 'cart-outline', on: true } };
export const New = { args: { label: '+ New category', dashed: true } };
export const LongName = {
  args: { label: 'Kids, school trips and after-school classes' },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: { label: 'תחבורה', icon: 'car-outline' },
};
