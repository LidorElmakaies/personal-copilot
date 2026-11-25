import { STATEMENT, STATEMENT_LINES } from '../mocks';
import StatementProgress from './StatementProgress';

const unread = { lineCount: undefined, totalAgorot: undefined };

export default {
  component: StatementProgress,
  parameters: { language: 'en' },
  args: {
    status: 'matching',
    lineCount: STATEMENT_LINES.length,
    totalAgorot: STATEMENT.declaredTotalAgorot,
  },
};

export const Received = { args: { status: 'received', ...unread } };
export const ReadingLines = { args: { status: 'parsing', ...unread } };
export const Matching = {};
export const Done = { args: { status: 'needs_review' } };
export const Pasted = {
  args: { status: 'parsing', source: 'text', ...unread },
};
export const OneLine = { args: { lineCount: 1, totalAgorot: 4990 } };
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewPasted = {
  parameters: { language: 'he' },
  args: { status: 'parsing', source: 'text', ...unread },
};
