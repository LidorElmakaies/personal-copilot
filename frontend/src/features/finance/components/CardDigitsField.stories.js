import { useState } from 'react';
import { CARDS } from '../mocks';
import CardDigitsField from './CardDigitsField';

export default {
  component: CardDigitsField,
  parameters: { language: 'en' },
};

// Typing changes it here only.
const Field = ({ digits = '', cards = CARDS }) => {
  const [value, setValue] = useState(digits);
  return <CardDigitsField value={value} onChange={setValue} cards={cards} />;
};

export const Empty = { render: () => <Field /> };
export const ThreeDigits = { render: () => <Field digits="482" /> };
export const LastCard = { render: () => <Field digits={CARDS[0]} /> };
export const AnotherCard = { render: () => <Field digits="1234" /> };
// The first time: no card used yet, no pills.
export const NoCards = { render: () => <Field cards={[]} /> };
export const OneCard = { render: () => <Field cards={CARDS.slice(0, 1)} /> };
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Field />,
};
export const HebrewLastCard = {
  parameters: { language: 'he' },
  render: () => <Field digits={CARDS[0]} />,
};
