import { STATEMENT_LINES } from '../mocks';
import StatementReviewScreen from './StatementReviewScreen';

const without = (...statuses) =>
  STATEMENT_LINES.filter((l) => !statuses.includes(l.matchStatus));
const unmatched = STATEMENT_LINES.filter((l) => l.matchStatus === 'unmatched');

export default {
  component: StatementReviewScreen,
  parameters: { layout: 'fullscreen', language: 'en' },
};

// As drawn: one question, 5 not reported. Answering it changes it here only.
export const AsDrawn = {};
export const NoQuestions = { args: { initialLines: without('suggested') } };
export const OnlyQuestions = { args: { initialLines: without('unmatched') } };
// A month with 30 not reported.
export const ThirtyUnreported = {
  args: {
    initialLines: [
      ...without('unmatched'),
      ...Array.from({ length: 30 }, (_, i) => ({
        ...unmatched[i % unmatched.length],
        id: `story-${i}`,
      })),
    ],
  },
};
// Nothing left to answer: the month is closed.
export const Closed = {
  args: { initialLines: without('suggested', 'unmatched') },
};
export const Hebrew = { parameters: { language: 'he' } };
