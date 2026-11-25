import { STATEMENT_LINES } from '../mocks';
import ChargeSummary from './ChargeSummary';

const lineOf = (merchant) =>
  STATEMENT_LINES.find(
    (l) => l.merchantRaw === merchant && l.matchStatus === 'unmatched',
  );

export default {
  component: ChargeSummary,
  parameters: { language: 'en' },
  args: { line: lineOf('BIT') },
};

const hebrew = { language: 'he' };
const long = {
  line: {
    ...lineOf('KSP'),
    merchantRaw: 'שופרסל אונליין בע"מ — סניף מרכז העיר תל אביב',
  },
};

// As drawn.
export const Bit = {};
export const Installment = { args: { line: lineOf('KSP') } };
export const Foreign = { args: { line: lineOf('AMAZON') } };
export const Refund = {
  args: { line: { ...lineOf('NETFLIX.COM'), amountAgorot: -4990 } },
};
export const LongShop = { args: long };
export const Hebrew = { parameters: hebrew };
export const HebrewLongShop = { parameters: hebrew, args: long };
