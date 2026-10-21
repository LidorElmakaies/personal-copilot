import {
  createAsyncThunk,
  createSelector,
  createSlice,
} from '@reduxjs/toolkit';
import * as customRemindersService from '../services/customRemindersService';
import { clearAuth, deleteAccount, selectUserId } from '../../account';

// The user's own reminders, for the Calendar tab's loaded months (see CalendarScreen.js). A change sends
// those months along and the server answers with the changed reminder's days in them, so the app
// swaps in just that one — no second request for the list.

const token = (getState) => getState().auth.accessToken;
const message = (err) => err?.message ?? String(err);
const sameRange = (a, b) => a?.from === b?.from && a?.to === b?.to;

// A list that left before a change and arrives after it would undo it on screen, so it's asked
// for again (a few times at most — each retry only follows another change).
const MAX_LIST_ATTEMPTS = 3;

export const fetchCustomReminders = createAsyncThunk(
  'customReminders/fetch',
  async ({ from, to }, { getState, rejectWithValue }) => {
    try {
      for (let attempt = 1; ; attempt++) {
        const seq = getState().customReminders.changeSeq;
        const list = await customRemindersService.getCustomReminders(
          token(getState),
          from,
          to,
        );
        if (
          getState().customReminders.changeSeq === seq ||
          attempt === MAX_LIST_ATTEMPTS
        )
          return list;
      }
    } catch (err) {
      return rejectWithValue(message(err));
    }
  },
);

// The sheet's "Next" dates. `key` identifies what was asked, so an older answer arriving late is
// dropped.
export const previewCustomReminder = createAsyncThunk(
  'customReminders/preview',
  (timing, { getState, rejectWithValue }) =>
    customRemindersService
      .previewCustomReminder(token(getState), timing)
      .catch((err) => rejectWithValue(message(err))),
);

// One change against the months shown. `run` resolves with { changed: [reminders with `dates`],
// removed: [ids] }; an error may carry `changed` too (a step that went through before one failed).
// An answer that lands after its user signed out is dropped (`ignored`), so it never reaches the
// next one; if the months moved while it was saving, its days are for the old ones — ask again.
const change = (type, run) =>
  createAsyncThunk(
    `customReminders/${type}`,
    async (arg, { getState, dispatch, rejectWithValue }) => {
      const { range } = getState().customReminders;
      const userId = selectUserId(getState());
      const settle = () => {
        if (selectUserId(getState()) !== userId) return false;
        const now = getState().customReminders.range;
        if (now && !sameRange(range, now)) dispatch(fetchCustomReminders(now));
        return true;
      };
      try {
        const result = await run(token(getState), arg, range ?? undefined);
        if (!settle()) return { ignored: true };
        return { changed: [], removed: [], ...result, range };
      } catch (err) {
        if (!settle()) return rejectWithValue({ ignored: true });
        return rejectWithValue({
          error: message(err),
          changed: err?.changed ?? [],
          removed: [],
          range,
        });
      }
    },
  );

export const createCustomReminder = change(
  'create',
  async (t, input, range) => ({
    changed: [
      await customRemindersService.createCustomReminder(t, input, range),
    ],
  }),
);
export const updateCustomReminder = change(
  'update',
  async (t, { id, patch }, range) => ({
    changed: [
      await customRemindersService.updateCustomReminder(t, id, patch, range),
    ],
  }),
);
export const deleteCustomReminder = change('delete', async (t, id) => {
  await customRemindersService.deleteCustomReminder(t, id);
  return { removed: [id] };
});
export const skipCustomReminderDay = change(
  'skip',
  async (t, { id, date }, range) => ({
    changed: [
      await customRemindersService.skipCustomReminderDay(t, id, date, range),
    ],
  }),
);
// "Only this day" on an edit: `date` becomes a once-reminder of its own, then the series skips it.
// In that order, so a failure in between leaves the day twice (deletable), never missing. A retry
// passes `copyId`, the once-reminder the failed try already made: it's updated, not made again.
export const editCustomReminderDay = change(
  'editDay',
  async (t, { id, date, input, copyId }, range) => {
    const created = copyId
      ? await customRemindersService.updateCustomReminder(
          t,
          copyId,
          input,
          range,
        )
      : await customRemindersService.createCustomReminder(
          t,
          { ...input, repeat: 'once', calendar: 'gregorian', start: date },
          range,
        );
    try {
      const series = await customRemindersService.skipCustomReminderDay(
        t,
        id,
        date,
        range,
      );
      return { changed: [created, series] };
    } catch (err) {
      throw Object.assign(new Error(message(err)), { changed: [created] });
    }
  },
);

const MUTATIONS = [
  createCustomReminder,
  updateCustomReminder,
  deleteCustomReminder,
  skipCustomReminderDay,
  editCustomReminderDay,
];

// Not persisted; reset on sign-out so one user's reminders never reach the next.
const initialState = {
  items: [], // each reminder with `dates` in `range`
  range: null, // { from, to } last asked for
  listRequest: null, // the latest list request's id; only its answer is used
  changeSeq: 0, // +1 on every change, so a list that crossed one is asked for again
  saving: false, // a change in flight
  error: null, // of the last change; the sheet shows it
  preview: { key: null, next: null, failed: false },
};

// Swaps in the changed reminders (their days in `range`) and drops the removed ones.
function applyChange(state, { changed, removed, range }) {
  state.changeSeq += 1;
  state.items = state.items.filter((r) => !removed.includes(r.id));
  if (!sameRange(range, state.range)) return; // a fresh list is on its way
  for (const reminder of changed) {
    if (!reminder.dates) continue;
    const i = state.items.findIndex((r) => r.id === reminder.id);
    if (i >= 0) state.items[i] = reminder;
    else state.items.push(reminder);
  }
}

const customRemindersSlice = createSlice({
  name: 'customReminders',
  initialState,
  reducers: {
    clearCustomReminderError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomReminders.pending, (state, action) => {
        state.range = action.meta.arg;
        state.listRequest = action.meta.requestId;
      })
      .addCase(fetchCustomReminders.fulfilled, (state, action) => {
        if (action.meta.requestId === state.listRequest)
          state.items = action.payload;
      })
      .addCase(previewCustomReminder.pending, (state, action) => {
        state.preview = {
          key: previewKey(action.meta.arg),
          next: null,
          failed: false,
        };
      })
      .addCase(previewCustomReminder.fulfilled, (state, action) => {
        if (state.preview.key === previewKey(action.meta.arg))
          state.preview.next = action.payload.next;
      })
      .addCase(previewCustomReminder.rejected, (state, action) => {
        if (state.preview.key === previewKey(action.meta.arg))
          state.preview.failed = true;
      });
    for (const thunk of MUTATIONS) {
      builder
        .addCase(thunk.pending, (state) => {
          state.saving = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.saving = false;
          if (!action.payload.ignored) applyChange(state, action.payload);
        })
        .addCase(thunk.rejected, (state, action) => {
          state.saving = false;
          const payload = action.payload;
          if (payload?.ignored) return;
          state.error = payload?.error ?? action.error.message;
          if (payload?.changed.length) applyChange(state, payload);
        });
    }
    builder
      .addCase(clearAuth, () => initialState)
      .addCase(deleteAccount.fulfilled, () => initialState);
  },
});

export const previewKey = ({ hour, minute, repeat, calendar, start }) =>
  `${hour}:${minute}:${repeat}:${calendar}:${start}`;

// { 'YYYY-MM-DD': [{ id, title, hour, minute, reminder }] }, each day sorted by time — what the
// grid counts and the day card lists.
export const selectDayReminders = createSelector(
  (state) => state.customReminders.items,
  (items) => {
    const byDate = {};
    for (const reminder of items) {
      for (const date of reminder.dates) {
        (byDate[date] ??= []).push({
          id: reminder.id,
          title: reminder.title,
          hour: reminder.hour,
          minute: reminder.minute,
          reminder,
        });
      }
    }
    for (const list of Object.values(byDate))
      list.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    return byDate;
  },
);

export const { clearCustomReminderError } = customRemindersSlice.actions;
export default customRemindersSlice.reducer;
