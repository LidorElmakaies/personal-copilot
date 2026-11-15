import { useState } from 'react';
import AmountInput from './AmountInput';

export default { component: AmountInput, parameters: { language: 'en' } };

// Typing changes it here only.
const Amount = ({ value = '', ...props }) => {
  const [text, setText] = useState(value);
  return <AmountInput {...props} value={text} onChangeText={setText} />;
};

// "₪ 0" in grey, the keyboard up.
export const Empty = { render: () => <Amount /> };
export const Typed = { render: () => <Amount value="150" /> };
export const WithAgorot = { render: () => <Amount value="284.90" /> };
export const Largest = { render: () => <Amount value="1234567.89" /> };
export const NoKeyboard = {
  render: () => <Amount value="150" autoFocus={false} />,
};
// ₪ still on the left.
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Amount value="150" />,
};
