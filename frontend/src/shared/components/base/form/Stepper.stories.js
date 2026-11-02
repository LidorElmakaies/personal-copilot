import { useState } from 'react';
import Stepper from './Stepper';

export default { component: Stepper, parameters: { language: 'en' } };

// − and + change it here only.
const Counter = ({ unit }) => {
  const [value, setValue] = useState(20);
  return (
    <Stepper
      value={value}
      onChange={setValue}
      min={0}
      max={120}
      step={5}
      unit={unit}
    />
  );
};

export const Minutes = { render: () => <Counter unit="min" /> };

export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Counter unit="דק׳" />,
};
