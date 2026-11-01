import GradientButton from './GradientButton';

export default {
  component: GradientButton,
  args: { label: 'Save' },
  argTypes: { onPress: { action: 'pressed' } },
};

export const Primary = {};
export const Loading = { args: { loading: true } };
export const Disabled = { args: { disabled: true } };

// Its capitals and letter-spacing dropped.
export const Hebrew = {
  parameters: { language: 'he' },
  args: { label: 'שמירה' },
};
