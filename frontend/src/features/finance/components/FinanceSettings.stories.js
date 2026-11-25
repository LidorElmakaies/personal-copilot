import { useState } from 'react';
import { CARDS, FINANCE_SETTINGS } from '../mocks';
import FinanceSettings from './FinanceSettings';

// Changed here only.
const Settings = ({ settings, ...args }) => {
  const [current, setCurrent] = useState(settings);
  return <FinanceSettings {...args} settings={current} onChange={setCurrent} />;
};

export default {
  component: FinanceSettings,
  parameters: { language: 'en' },
  render: (args) => <Settings {...args} />,
  args: { settings: FINANCE_SETTINGS, usedCards: CARDS },
  argTypes: { onCategories: { action: 'categories' } },
};

const three = {
  ...FINANCE_SETTINGS,
  cards: [
    ...FINANCE_SETTINGS.cards,
    { cardLast4: '5520', billingDay: 2 },
    { cardLast4: '1177', issuer: 'Isracard', billingDay: 31 },
  ],
};

export const OneCard = {};
export const ThreeCards = { args: { settings: three } };
export const NoCards = {
  args: { settings: { ...FINANCE_SETTINGS, cards: [] } },
};
export const RemindersOff = {
  args: {
    settings: {
      ...FINANCE_SETTINGS,
      reminders: { enabled: false, hour: 21, minute: 0 },
    },
  },
};
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewThreeCards = {
  parameters: { language: 'he' },
  args: { settings: three },
};
