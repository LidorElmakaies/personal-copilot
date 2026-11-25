import MonthClosed from './MonthClosed';

export default {
  component: MonthClosed,
  parameters: { language: 'en' },
  args: {
    month: { year: 2026, month: 10 },
    charges: 42,
    totalAgorot: 784000,
    reported: 36,
    answered: 6,
  },
  argTypes: { onBack: { action: 'back' } },
};

// As drawn.
export const October = {};
export const AllReported = { args: { reported: 42, answered: 0 } };
export const NoneReported = { args: { reported: 0, answered: 42 } };
export const One = {
  args: { charges: 1, totalAgorot: 4990, reported: 0, answered: 1 },
};
export const Hebrew = { parameters: { language: 'he' } };
