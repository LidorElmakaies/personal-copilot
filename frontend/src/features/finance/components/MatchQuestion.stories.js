import { OCTOBER_ENTRIES, STATEMENT_LINES } from '../mocks';
import MatchQuestion from './MatchQuestion';

const line = STATEMENT_LINES.find((l) => l.matchStatus === 'suggested');
const candidates = line.suggestion.candidateEntryIds.map((id) =>
  OCTOBER_ENTRIES.find((e) => e.id === id),
);

export default {
  component: MatchQuestion,
  parameters: { language: 'en' },
  args: { line, candidates },
  argTypes: {
    onYes: { action: 'yes' },
    onNeither: { action: 'neither' },
  },
};

const hebrew = { language: 'he' };
const long = {
  line: {
    ...line,
    merchantRaw: 'שופרסל אונליין בע"מ — סניף מרכז העיר תל אביב',
  },
  candidates: [
    {
      ...candidates[0],
      description: 'Groceries and cleaning stuff for the week',
    },
    candidates[1],
  ],
};

// As drawn.
export const TwoMatch = {};
export const ThreeMatch = {
  args: {
    candidates: [
      ...candidates,
      { ...candidates[0], id: 'third', description: 'מתנה לנועה' },
    ],
  },
};
export const OneMatches = { args: { candidates: candidates.slice(0, 1) } };
export const LongText = { args: long };
export const Hebrew = { parameters: hebrew };
export const HebrewThreeMatch = {
  parameters: hebrew,
  args: ThreeMatch.args,
};
export const HebrewLongText = { parameters: hebrew, args: long };
