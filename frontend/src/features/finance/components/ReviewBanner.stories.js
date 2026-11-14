import ReviewBanner from './ReviewBanner';

// October's MAX ••4821 statement as on the canvas: 6 to answer, 36 matched.
export default {
  component: ReviewBanner,
  parameters: { language: 'en' },
  args: {
    month: { year: 2026, month: 10 },
    toAnswer: 6,
    issuer: 'MAX',
    cardLast4: '4821',
    reported: 36,
  },
  argTypes: { onPress: { action: 'pressed' } },
};

export const October = {};
export const OneToAnswer = { args: { toAnswer: 1, reported: 1 } };
// The longest month name, three-digit counts: the lines wrap, the arrow stays put.
export const LongAndMany = {
  args: { month: { year: 2026, month: 9 }, toAnswer: 128, reported: 312 },
};
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewOne = {
  parameters: { language: 'he' },
  args: { toAnswer: 1, reported: 1 },
};
