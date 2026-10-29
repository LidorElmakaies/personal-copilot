import FinanceHeader from './FinanceHeader';

export default {
  component: FinanceHeader,
  args: { month: { year: 2026, month: 10 } },
  argTypes: {
    onPrevious: { action: 'previous' },
    onMonthlyCheck: { action: 'monthly check' },
  },
};

// The latest month: › is dimmed.
export const CurrentMonth = {};
export const EarlierMonth = {
  args: { month: { year: 2026, month: 9 } },
  argTypes: { onNext: { action: 'next' } },
};
