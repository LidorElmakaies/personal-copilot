import CustomReminderSheet from './CustomReminderSheet';

// The add/edit sheet over the app's real store: Save and Delete change the dev build's own
// reminders, as in the app — close it to leave them as they are.
const MONTHLY_HEBREW = {
  id: 'story-1',
  title: 'Call grandma',
  hour: 12,
  minute: 30,
  repeat: 'monthly',
  calendar: 'hebrew',
  start: '2026-10-30',
  skipped: [],
  changed: {},
};

export default {
  component: CustomReminderSheet,
  args: { target: { reminder: null, date: '2026-10-30' } },
  argTypes: {
    onClose: { action: 'closed' },
    onSaved: { action: 'saved' },
  },
};

export const New = {};

export const NewHebrew = { parameters: { language: 'he' } };

// A Hebrew-calendar monthly reminder tapped on 30 October: the calendar choices, the next dates.
export const Edit = {
  args: { target: { reminder: MONTHLY_HEBREW, date: '2026-10-30' } },
};

export const EditHebrew = {
  parameters: { language: 'he' },
  args: { target: { reminder: MONTHLY_HEBREW, date: '2026-10-30' } },
};
