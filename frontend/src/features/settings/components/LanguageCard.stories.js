import { useState } from 'react';
import LanguageCard from './LanguageCard';

export default { component: LanguageCard };

// A tap moves the pick here only — the app's language stays as it is.
const Picker = ({ initial }) => {
  const [value, setValue] = useState(initial);
  return <LanguageCard value={value} onChange={setValue} />;
};

export const English = { render: () => <Picker initial="en" /> };

export const Hebrew = { render: () => <Picker initial="he" /> };
