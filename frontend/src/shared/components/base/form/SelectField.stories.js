import { useState } from 'react';
import SelectField from './SelectField';

export default { component: SelectField, parameters: { language: 'en' } };

// A pick changes it here only.
const Select = ({ label, options }) => {
  const [value, setValue] = useState(options[0].value);
  return (
    <SelectField
      label={label}
      value={value}
      options={options}
      onChange={setValue}
    />
  );
};

export const PaidWith = {
  render: () => (
    <Select
      label="Paid with"
      options={[
        { value: 'card', label: 'Card' },
        { value: 'bit', label: 'Bit' },
        { value: 'cash', label: 'Cash' },
      ]}
    />
  ),
};

export const Hebrew = {
  parameters: { language: 'he' },
  render: () => (
    <Select
      label="שולם ב"
      options={[
        { value: 'card', label: 'כרטיס' },
        { value: 'bit', label: 'ביט' },
        { value: 'cash', label: 'מזומן' },
      ]}
    />
  ),
};
