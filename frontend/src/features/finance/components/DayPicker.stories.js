import { useState } from 'react';
import { TODAY } from '../mocks';
import DayPicker from './DayPicker';

export default { component: DayPicker, parameters: { language: 'en' } };

// Picking changes it here only.
const Picker = ({ day = TODAY }) => {
  const [value, setValue] = useState(day);
  return <DayPicker value={value} today={TODAY} onChange={setValue} />;
};

export const Today = { render: () => <Picker /> };
export const AnotherDay = { render: () => <Picker day="2026-10-12" /> };
// Six weeks.
export const LongMonth = { render: () => <Picker day="2026-08-31" /> };
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Picker />,
};
