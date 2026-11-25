import { STATEMENT_LINES } from '../mocks';
import UnreportedRow from './UnreportedRow';

const lineOf = (merchant) =>
  STATEMENT_LINES.find(
    (l) => l.merchantRaw === merchant && l.matchStatus === 'unmatched',
  );

export default {
  component: UnreportedRow,
  parameters: { language: 'en' },
  args: { line: lineOf('NETFLIX.COM') },
  argTypes: { onPress: { action: 'pressed' } },
};

const hebrew = { language: 'he' };

export const Plain = {};
export const HebrewShop = { args: { line: lineOf('שופרסל דיל') } };
export const Installment = { args: { line: lineOf('KSP') } };
export const Foreign = { args: { line: lineOf('AMAZON') } };
export const InstallmentAndForeign = {
  args: {
    line: { ...lineOf('AMAZON'), installmentNo: 2, installmentsTotal: 3 },
  },
};
// A currency without a symbol of ours.
export const OtherCurrency = {
  args: {
    line: {
      ...lineOf('AMAZON'),
      merchantRaw: 'SBB BERN',
      originalCurrency: 'CHF',
    },
  },
};
export const Refund = {
  args: { line: { ...lineOf('NETFLIX.COM'), amountAgorot: -4990 } },
};
export const LongShop = {
  args: {
    line: {
      ...lineOf('KSP'),
      merchantRaw: 'שופרסל אונליין בע"מ — סניף מרכז העיר תל אביב',
    },
  },
};
export const Hebrew = { parameters: hebrew };
export const HebrewInstallment = {
  parameters: hebrew,
  args: { line: lineOf('KSP') },
};
export const HebrewForeign = {
  parameters: hebrew,
  args: InstallmentAndForeign.args,
};
export const HebrewLongShop = { parameters: hebrew, args: LongShop.args };
