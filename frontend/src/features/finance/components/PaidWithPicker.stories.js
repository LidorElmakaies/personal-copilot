import { useState } from 'react';
import PaidWithPicker from './PaidWithPicker';

export default {
  component: PaidWithPicker,
  parameters: { language: 'en' },
};

// Picking changes it here only.
const Picker = ({ paidWith }) => {
  const [value, setValue] = useState(paidWith);
  return <PaidWithPicker value={value} onChange={setValue} />;
};

export const Card = { render: () => <Picker paidWith="card" /> };
export const Bit = { render: () => <Picker paidWith="bit" /> };
export const PayBox = { render: () => <Picker paidWith="paybox" /> };
export const Cash = { render: () => <Picker paidWith="cash" /> };
export const Transfer = { render: () => <Picker paidWith="transfer" /> };
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Picker paidWith="card" />,
};
