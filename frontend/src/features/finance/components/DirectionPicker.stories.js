import { useState } from 'react';
import DirectionPicker from './DirectionPicker';

export default {
  component: DirectionPicker,
  parameters: { language: 'en' },
};

// Picking changes it here only.
const Picker = ({ direction }) => {
  const [value, setValue] = useState(direction);
  return <DirectionPicker value={value} onChange={setValue} />;
};

export const Spent = { render: () => <Picker direction="expense" /> };
export const Received = { render: () => <Picker direction="income" /> };
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Picker direction="income" />,
};
