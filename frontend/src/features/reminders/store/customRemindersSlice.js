import {
  createAsyncThunk,
  createSelector,
  createSlice,
  nanoid,
} from '@reduxjs/toolkit';
import { titleProblem } from '../utils/customReminders';
import { datesFor, fallsOn } from '../utils/occurrences';
import { reconcileReminderNotifications } from './scheduleNotifications';

// The user's own reminders, kept on the phone (`items` persisted — src/store/index.js). `items`
// are the definitions only; which days each falls on in the Calendar tab's loaded months (`range`)
// is worked out by selectDayReminders. A definition's `changed` holds days given their own title
// and time ("Only this day" on an edit).

const MAX_REMINDERS = 300;

const findReminder = (getState, id) =>
  getState().customReminders.items.find((r) => r.id === id);

const trimTitle = (fields) =>
  typeof fields.title === 'string'
    ? { ...fields, title: fields.title.trim() }
    : fields;

// Each change saves with one plain action and starts the notifications' reconcile without waiting
// for it. A bad title or the reminders cap rejects with the message the sheet shows (state.error);
// a missing reminder does nothing.
export const createCustomReminder = createAsyncThunk(
  'customReminders/create',
  async (input, { getState, dispatch, rejectWithValue }) => {
    const problem = titleProblem(input.title);
    if (problem) return rejectWithValue(problem);
    if (getState().customReminders.items.length >= MAX_REMINDERS)
      return rejectWithValue(`At most ${MAX_REMINDERS} reminders`);
    const reminder = {
      calendar: 'gregorian',
      ...trimTitle(input),
      id: nanoid(),
      skipped: [],
      changed: {},
    };
    dispatch(reminderAdded(reminder));
    dispatch(reconcileReminderNotifications());
    return reminder;
  },
);

// Only the fields in `patch` change ("Every time"). Changed days the new rule no longer falls on
// (skips counted, as for editCustomReminderDay) are dropped, and so is `date`'s — the day the sheet
// was opened from, whose title and time the form started from; the others keep their own.
export const updateCustomReminder = createAsyncThunk(
  'customReminders/update',
  async ({ id, patch, date }, { getState, dispatch, rejectWithValue }) => {
    const fields = trimTitle(patch);
    if (fields.title !== undefined) {
      const problem = titleProblem(fields.title);
      if (problem) return rejectWithValue(problem);
    }
    const reminder = findReminder(getState, id);
    if (!reminder) return;
    const next = { ...reminder, ...fields };
    const changed = Object.fromEntries(
      Object.entries(reminder.changed).filter(
        ([day]) => day !== date && fallsOn(next, day),
      ),
    );
    dispatch(reminderUpdated({ id, fields: { ...fields, changed } }));
    dispatch(reconcileReminderNotifications());
    return findReminder(getState, id);
  },
);

export const deleteCustomReminder = createAsyncThunk(
  'customReminders/delete',
  async (id, { dispatch }) => {
    dispatch(reminderRemoved(id));
    dispatch(reconcileReminderNotifications());
    return id;
  },
);

// "Only this day" on a delete: the reminder leaves `date` out, and that day's own title/time with
// it. Already left out: nothing changes.
export const skipCustomReminderDay = createAsyncThunk(
  'customReminders/skip',
  async ({ id, date }, { getState, dispatch }) => {
    dispatch(daySkipped({ id, date }));
    dispatch(reconcileReminderNotifications());
    return findReminder(getState, id);
  },
);

// "Only this day" on an edit: `date` gets `input`'s own title, hour and minute (`changed[date]`);
// the same as the series' own drops the entry. Again for the same day overwrites it. Resolves with
// the reminder.
export const editCustomReminderDay = createAsyncThunk(
  'customReminders/editDay',
  async ({ id, date, input }, { getState, dispatch, rejectWithValue }) => {
    const problem = titleProblem(input.title);
    if (problem) return rejectWithValue(problem);
    const reminder = findReminder(getState, id);
    if (!reminder) return;
    const day = {
      title: input.title.trim(),
      hour: input.hour,
      minute: input.minute,
    };
    const same =
      day.title === reminder.title &&
      day.hour === reminder.hour &&
      day.minute === reminder.minute;
    dispatch(dayEdited({ id, date, day: same ? null : day }));
    dispatch(reconcileReminderNotifications());
    return findReminder(getState, id);
  },
);

const MUTATIONS = [
  createCustomReminder,
  updateCustomReminder,
  deleteCustomReminder,
  skipCustomReminderDay,
  editCustomReminderDay,
];

const initialState = {
  items: [], // { id, title, hour, minute, repeat, calendar, start, skipped, changed } — persisted
  range: null, // { from, to }: the Calendar tab's loaded months
  error: null, // of the last change; the sheet shows it
};

const customRemindersSlice = createSlice({
  name: 'customReminders',
  initialState,
  reducers: {
    setRemindersRange(state, action) {
      state.range = action.payload;
    },
    clearCustomReminderError(state) {
      state.error = null;
    },
    reminderAdded(state, action) {
      state.items.push(action.payload);
    },
    reminderUpdated(state, { payload: { id, fields } }) {
      const reminder = state.items.find((r) => r.id === id);
      if (reminder) Object.assign(reminder, fields);
    },
    reminderRemoved(state, action) {
      state.items = state.items.filter((r) => r.id !== action.payload);
    },
    daySkipped(state, { payload: { id, date } }) {
      const reminder = state.items.find((r) => r.id === id);
      if (!reminder) return;
      if (!reminder.skipped.includes(date))
        reminder.skipped = [...reminder.skipped, date].sort();
      delete reminder.changed[date];
    },
    // `day` { title, hour, minute }, or null to give the day back the series' own.
    dayEdited(state, { payload: { id, date, day } }) {
      const reminder = state.items.find((r) => r.id === id);
      if (!reminder) return;
      if (day) reminder.changed[date] = day;
      else delete reminder.changed[date];
    },
  },
  extraReducers: (builder) => {
    for (const thunk of MUTATIONS) {
      builder
        .addCase(thunk.pending, (state) => {
          state.error = null;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.error = action.payload ?? action.error.message;
        });
    }
  },
});

const {
  reminderAdded,
  reminderUpdated,
  reminderRemoved,
  daySkipped,
  dayEdited,
} = customRemindersSlice.actions;

// A reminder's days in a range, kept per definition object: a change replaces only that
// reminder's object, so the others' days aren't worked out again.
const datesCache = new WeakMap();
function cachedDates(reminder, range) {
  const hit = datesCache.get(reminder);
  if (hit && hit.from === range.from && hit.to === range.to) return hit.dates;
  const dates = datesFor(reminder, range);
  datesCache.set(reminder, { from: range.from, to: range.to, dates });
  return dates;
}

// { 'YYYY-MM-DD': [{ id, title, hour, minute, reminder }] }, each day sorted by time — what the
// grid counts and the day card lists. On a changed day the row has that day's own title and time;
// `reminder` is always the series. Empty until the Calendar tab sets a range.
export const selectDayReminders = createSelector(
  (state) => state.customReminders.items,
  (state) => state.customReminders.range,
  (items, range) => {
    const byDate = {};
    if (!range) return byDate;
    for (const reminder of items) {
      for (const date of cachedDates(reminder, range)) {
        const day = reminder.changed[date];
        const row = {
          id: reminder.id,
          title: reminder.title,
          hour: reminder.hour,
          minute: reminder.minute,
          reminder,
        };
        (byDate[date] ??= []).push(day ? { ...row, ...day } : row);
      }
    }
    for (const list of Object.values(byDate))
      list.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    return byDate;
  },
);

export const { setRemindersRange, clearCustomReminderError } =
  customRemindersSlice.actions;
export default customRemindersSlice.reducer;
