import MonthHeader from './MonthHeader';

export default {
  component: MonthHeader,
  parameters: { language: 'en' },
  args: { title: 'October 2026', hebrewTitle: 'תשרי – חשון תשפ״ז' },
  argTypes: {
    onPrevious: { action: 'previous' },
    onNext: { action: 'next' },
    onToday: { action: 'today' },
  },
};

// Away from today's month: the Today pill shows.
export const AwayFromToday = {};

// Today's month: no pill.
export const ThisMonth = { args: { onToday: undefined } };

export const Hebrew = {
  parameters: { language: 'he' },
  args: { title: 'אוקטובר 2026' },
};
