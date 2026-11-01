import { useState } from 'react';
import InputField from './InputField';

export default { component: InputField };

// Typing changes it here only.
const Field = (props) => {
  const [value, setValue] = useState(props.value ?? '');
  return <InputField {...props} value={value} onChangeText={setValue} />;
};

export const Empty = {
  render: () => <Field label="What for" placeholder="Dinner with Dana" />,
};
export const WithError = {
  render: () => (
    <Field
      label="Amount"
      value="12.345"
      error="At most 2 digits after the dot"
    />
  ),
};

// The label plain, the text from the right.
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Field label="על מה" value="ארוחת ערב עם דנה" />,
};
