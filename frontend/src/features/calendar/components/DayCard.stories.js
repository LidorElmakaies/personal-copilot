import { EREV_SHABBAT, EREV_SHABBAT_REMINDERS, NOW, OCTOBER } from '../mocks';
import DayCard from './DayCard';

export default {
  component: DayCard,
  args: { day: EREV_SHABBAT, now: NOW },
  argTypes: {
    onShowAll: { action: 'show all' },
    onPressReminder: { action: 'reminder pressed' },
  },
};

// Friday 30 October: Erev Shabbat, candle lighting, two reminders.
export const ErevShabbat = { args: { reminders: EREV_SHABBAT_REMINDERS } };

// A plain weekday, today: its title is the weekday's name.
export const PlainDay = { args: { day: OCTOBER.days[26], isToday: true } };

export const Hebrew = {
  parameters: { language: 'he' },
  args: { reminders: EREV_SHABBAT_REMINDERS },
};

export const HebrewPlainDay = {
  parameters: { language: 'he' },
  args: { day: OCTOBER.days[26], isToday: true },
};
