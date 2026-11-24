import { useState } from 'react';
import { STATEMENT_CARDS } from '../mocks';
import CardChips from './CardChips';

export default { component: CardChips, parameters: { language: 'en' } };

// Picking changes it here only.
const Chips = ({
  cards = STATEMENT_CARDS,
  start = cards[0]?.last4 ?? null,
}) => {
  const [value, setValue] = useState(start);
  return <CardChips cards={cards} value={value} onChange={setValue} />;
};

export const SixCards = { render: () => <Chips /> };
export const OneCard = {
  render: () => <Chips cards={STATEMENT_CARDS.slice(0, 1)} />,
};
// The first time: no card used yet.
export const NoCards = { render: () => <Chips cards={[]} /> };
// A card typed, not among those used.
export const AnotherCard = {
  render: () => <Chips cards={STATEMENT_CARDS.slice(0, 1)} start="1234" />,
};
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Chips />,
};
export const HebrewOneCard = {
  parameters: { language: 'he' },
  render: () => <Chips cards={STATEMENT_CARDS.slice(0, 1)} />,
};
