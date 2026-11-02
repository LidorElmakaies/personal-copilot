import { useState } from 'react';
import ProfileFields from './ProfileFields';

export default { component: ProfileFields, parameters: { language: 'en' } };

// Typing changes it here only. `phone` starts too short, so its error shows.
const Fields = () => {
  const [value, setValue] = useState({
    firstName: 'Dana',
    lastName: '',
    country: 'IL',
    phone: '05012',
  });
  return <ProfileFields value={value} onChange={setValue} showErrors />;
};

export const English = { render: () => <Fields /> };
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Fields />,
};
