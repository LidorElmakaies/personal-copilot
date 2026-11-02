import { useState } from 'react';
import { EREV_SHABBAT_REMINDERS, OCTOBER, TODAY } from '../mocks';
import MonthGrid from './MonthGrid';

export default { component: MonthGrid, parameters: { language: 'en' } };

// October 2026, today the 27th; a tap selects a day here only. Two reminders on the 30th.
const Grid = () => {
  const [selected, setSelected] = useState('2026-10-30');
  return (
    <MonthGrid
      days={OCTOBER.days}
      today={TODAY}
      selected={selected}
      onSelect={setSelected}
      reminders={{ '2026-10-30': EREV_SHABBAT_REMINDERS }}
    />
  );
};

export const October = { render: () => <Grid /> };

// The weekday letters in Hebrew.
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Grid />,
};
