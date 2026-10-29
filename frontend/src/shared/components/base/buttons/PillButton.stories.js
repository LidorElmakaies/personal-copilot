import PillButton from './PillButton';

export default {
  component: PillButton,
  args: { label: 'Monthly check' },
  argTypes: { onPress: { action: 'pressed' } },
};

export const Accent = {};
export const Muted = { args: { tone: 'muted', label: 'Close' } };
export const Pending = { args: { tone: 'pending', label: '20 min before' } };
export const Selected = { args: { tone: 'selected', label: 'Card' } };
