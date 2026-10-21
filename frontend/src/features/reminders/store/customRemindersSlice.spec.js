import { configureStore } from '@reduxjs/toolkit';
import { datesFor } from '../utils/occurrences';
import customRemindersReducer, {
  clearCustomReminderError,
  createCustomReminder,
  deleteCustomReminder,
  editCustomReminderDay,
  selectDayReminders,
  setRemindersRange,
  skipCustomReminderDay,
  updateCustomReminder,
} from './customRemindersSlice';

// The real datesFor, counted — so the per-definition cache can be checked by how often it runs.
jest.mock('../utils/occurrences', () => {
  const actual = jest.requireActual('../utils/occurrences');
  return { ...actual, datesFor: jest.fn(actual.datesFor) };
});

// The user's own reminders on the phone (task R3.1), in thunks over a small real store: the title
// rule and the reminders cap, changed and skipped days, and what the Calendar tab is given.

const makeStore = () =>
  configureStore({ reducer: { customReminders: customRemindersReducer } });

const valid = {
  title: 'Call Mom',
  hour: 9,
  minute: 30,
  repeat: 'daily',
  start: '2026-10-01',
};

const slice = (store) => store.getState().customReminders;

async function add(store, input = {}) {
  const action = await store.dispatch(
    createCustomReminder({ ...valid, ...input }),
  );
  expect(action.error).toBeUndefined();
  return action.payload;
}

// A rejected thunk's message (its payload), or a failure if it didn't reject.
async function rejection(store, thunkAction) {
  const action = await store.dispatch(thunkAction);
  expect(action.meta.requestStatus).toBe('rejected');
  return action.payload;
}

const TITLE_CHARS =
  'English or Hebrew letters, digits and . , \' ! ? : ( ) - " & / only, single spaces';

describe('customReminders slice', () => {
  let store;
  beforeEach(() => {
    store = makeStore();
    datesFor.mockClear();
  });

  describe('validation', () => {
    it.each([
      ['an empty title', { title: '' }, 'Give it a title'],
      ['a title of spaces', { title: '   ' }, 'Give it a title'],
      ['a title with other characters', { title: 'Call @Mom' }, TITLE_CHARS],
      ['a title with a double space', { title: 'Call  Mom' }, TITLE_CHARS],
      ['a title with an emoji', { title: 'Call Mom \u{1F600}' }, TITLE_CHARS],
    ])('create rejects %s', async (_, change, message) => {
      await expect(
        rejection(store, createCustomReminder({ ...valid, ...change })),
      ).resolves.toBe(message);
      expect(slice(store).items).toEqual([]);
    });

    it('takes a Hebrew title and one with the allowed punctuation', async () => {
      await add(store, { title: 'שבת שלום' });
      await add(store, { title: "Mom's (B-day) 2/3!" });
      expect(slice(store).items).toHaveLength(2);
    });

    it('allows at most 300 reminders', async () => {
      for (let i = 0; i < 300; i++) await add(store);
      await expect(rejection(store, createCustomReminder(valid))).resolves.toBe(
        'At most 300 reminders',
      );
      expect(slice(store).items).toHaveLength(300);
    });
  });

  describe('create', () => {
    it('trims the title, defaults the calendar to Gregorian, starts with no skipped days', async () => {
      const saved = await add(store, {
        title: '  Call Mom  ',
        repeat: 'monthly',
      });
      expect(saved).toStrictEqual({
        id: expect.any(String),
        title: 'Call Mom',
        hour: 9,
        minute: 30,
        repeat: 'monthly',
        calendar: 'gregorian',
        start: '2026-10-01',
        skipped: [],
        changed: {},
      });
      expect(slice(store).items).toStrictEqual([saved]);
    });

    it('keeps a Hebrew calendar', async () => {
      const saved = await add(store, { repeat: 'yearly', calendar: 'hebrew' });
      expect(saved.calendar).toBe('hebrew');
    });

    it('gives each reminder its own id', async () => {
      for (let i = 0; i < 20; i++) await add(store);
      const ids = slice(store).items.map((r) => r.id);
      expect(new Set(ids).size).toBe(20);
    });
  });

  describe('update', () => {
    it('changes only the given fields', async () => {
      const before = await add(store);
      const action = await store.dispatch(
        updateCustomReminder({ id: before.id, patch: { hour: 7 } }),
      );
      const expected = { ...before, hour: 7 };
      expect(action.payload).toStrictEqual(expected);
      expect(slice(store).items).toStrictEqual([expected]);
    });

    it('trims an updated title', async () => {
      const { id } = await add(store);
      await store.dispatch(
        updateCustomReminder({ id, patch: { title: '  Call Dad ' } }),
      );
      expect(slice(store).items[0].title).toBe('Call Dad');
    });

    it('rejects a title trimmed to nothing, and changes nothing', async () => {
      const before = await add(store);
      await expect(
        rejection(
          store,
          updateCustomReminder({ id: before.id, patch: { title: '   ' } }),
        ),
      ).resolves.toBe('Give it a title');
      expect(slice(store).items).toStrictEqual([before]);
    });
  });

  describe('delete', () => {
    it('removes just that reminder', async () => {
      const a = await add(store, { title: 'A' });
      const b = await add(store, { title: 'B' });
      const action = await store.dispatch(deleteCustomReminder(a.id));
      expect(action.payload).toBe(a.id);
      expect(slice(store).items).toStrictEqual([b]);
    });
  });

  describe('skip a day', () => {
    it('keeps the skipped days sorted', async () => {
      const { id } = await add(store);
      for (const date of ['2026-10-20', '2026-10-03', '2026-10-11'])
        await store.dispatch(skipCustomReminderDay({ id, date }));
      expect(slice(store).items[0].skipped).toEqual([
        '2026-10-03',
        '2026-10-11',
        '2026-10-20',
      ]);
    });

    it('an already-skipped day is a no-op, not an error', async () => {
      const { id } = await add(store);
      await store.dispatch(skipCustomReminderDay({ id, date: '2026-10-05' }));
      const before = slice(store).items;
      const action = await store.dispatch(
        skipCustomReminderDay({ id, date: '2026-10-05' }),
      );
      expect(action.meta.requestStatus).toBe('fulfilled');
      expect(slice(store).items).toStrictEqual(before);
      expect(slice(store).items[0].skipped).toEqual(['2026-10-05']);
    });
  });

  describe('edit only this day', () => {
    it('gives that day its own title and time, in place — no new reminder', async () => {
      const series = await add(store, {
        repeat: 'daily',
        calendar: 'gregorian',
      });
      const action = await store.dispatch(
        editCustomReminderDay({
          id: series.id,
          date: '2026-10-21',
          // only title/hour/minute come from the input
          input: {
            title: ' Moved ',
            hour: 10,
            minute: 15,
            repeat: 'yearly',
            calendar: 'hebrew',
            start: '2030-01-01',
          },
        }),
      );
      const edited = {
        ...series,
        changed: { '2026-10-21': { title: 'Moved', hour: 10, minute: 15 } },
      };
      expect(action.payload).toStrictEqual(edited);
      expect(slice(store).items).toStrictEqual([edited]);
    });

    // the series in these: daily from 2026-10-01, 'Call Mom' at 09:30
    const editDay = (id, date, input) =>
      store.dispatch(editCustomReminderDay({ id, date, input }));
    const changedOf = () => slice(store).items[0].changed;

    it('again for the same day overwrites it — one entry, still one reminder', async () => {
      const { id } = await add(store);
      await editDay(id, '2026-10-21', { title: 'Moved', hour: 10, minute: 15 });
      const action = await editDay(id, '2026-10-21', {
        title: 'Moved again',
        hour: 11,
        minute: 0,
      });
      expect(action.payload).toStrictEqual(slice(store).items[0]);
      expect(slice(store).items).toHaveLength(1);
      expect(changedOf()).toStrictEqual({
        '2026-10-21': { title: 'Moved again', hour: 11, minute: 0 },
      });
    });

    it('several days each keep their own', async () => {
      const { id } = await add(store);
      await editDay(id, '2026-10-21', { title: 'A', hour: 10, minute: 0 });
      await editDay(id, '2026-10-25', { title: 'B', hour: 8, minute: 5 });
      expect(changedOf()).toStrictEqual({
        '2026-10-21': { title: 'A', hour: 10, minute: 0 },
        '2026-10-25': { title: 'B', hour: 8, minute: 5 },
      });
    });

    it("the series' own title and time give the day back: the entry goes", async () => {
      const { id } = await add(store);
      await editDay(id, '2026-10-21', { title: 'Moved', hour: 10, minute: 15 });
      await editDay(id, '2026-10-21', {
        title: ' Call Mom ',
        hour: 9,
        minute: 30,
      });
      expect(changedOf()).toStrictEqual({});
      // and on a day never changed, the same values add nothing
      await editDay(id, '2026-10-22', {
        title: 'Call Mom',
        hour: 9,
        minute: 30,
      });
      expect(changedOf()).toStrictEqual({});
    });

    it('only the title differing is still a change of its own', async () => {
      const { id } = await add(store);
      await editDay(id, '2026-10-21', {
        title: 'Call Dad',
        hour: 9,
        minute: 30,
      });
      expect(changedOf()).toStrictEqual({
        '2026-10-21': { title: 'Call Dad', hour: 9, minute: 30 },
      });
    });

    it.each([
      ['   ', 'Give it a title'],
      ['Moved!!  now', TITLE_CHARS],
    ])('rejects the title %p and changes nothing', async (title, message) => {
      const series = await add(store);
      await expect(
        rejection(
          store,
          editCustomReminderDay({
            id: series.id,
            date: '2026-10-21',
            input: { title, hour: 10, minute: 0 },
          }),
        ),
      ).resolves.toBe(message);
      expect(slice(store).items).toStrictEqual([series]);
    });

    it("skipping a changed day drops that day's own title and time", async () => {
      const { id } = await add(store);
      await editDay(id, '2026-10-21', { title: 'A', hour: 10, minute: 0 });
      await editDay(id, '2026-10-22', { title: 'B', hour: 10, minute: 0 });
      await store.dispatch(skipCustomReminderDay({ id, date: '2026-10-21' }));
      expect(slice(store).items[0]).toMatchObject({
        skipped: ['2026-10-21'],
        changed: { '2026-10-22': { title: 'B', hour: 10, minute: 0 } },
      });
    });
  });

  describe('changed days and an "Every time" update', () => {
    const moved = { title: 'Moved', hour: 10, minute: 0 };

    // monthly on the 21st, from 21 Oct; 21 Oct and 21 Nov changed
    async function seriesWithChangedDays() {
      const { id } = await add(store, {
        repeat: 'monthly',
        start: '2026-10-21',
      });
      for (const date of ['2026-10-21', '2026-11-21'])
        await store.dispatch(editCustomReminderDay({ id, date, input: moved }));
      return id;
    }

    it('a day the new rule no longer falls on loses its entry', async () => {
      const id = await seriesWithChangedDays();
      await store.dispatch(
        updateCustomReminder({ id, patch: { start: '2026-10-22' } }),
      );
      expect(slice(store).items[0].changed).toStrictEqual({});
    });

    it('days still on the rule keep theirs', async () => {
      const id = await seriesWithChangedDays();
      // now from 21 Nov: 21 Oct is before the start, 21 Nov still on it
      const action = await store.dispatch(
        updateCustomReminder({ id, patch: { start: '2026-11-21' } }),
      );
      expect(action.payload.changed).toStrictEqual({ '2026-11-21': moved });
      expect(slice(store).items[0].changed).toStrictEqual({
        '2026-11-21': moved,
      });
    });

    it('a title or time change keeps every entry', async () => {
      const id = await seriesWithChangedDays();
      await store.dispatch(
        updateCustomReminder({ id, patch: { title: 'Pay rent', hour: 7 } }),
      );
      expect(slice(store).items[0]).toMatchObject({
        title: 'Pay rent',
        hour: 7,
        changed: { '2026-10-21': moved, '2026-11-21': moved },
      });
    });

    it("drops the entry of the day the sheet was opened from: its title and time are now the series'", async () => {
      // daily 'Call Mom' 09:00; 21 Oct opened (changed to 10:00), 25 Oct changed too
      const { id } = await add(store, { hour: 9, minute: 0 });
      const at10 = { title: 'Call Mom', hour: 10, minute: 0 };
      await store.dispatch(
        editCustomReminderDay({ id, date: '2026-10-21', input: at10 }),
      );
      await store.dispatch(
        editCustomReminderDay({ id, date: '2026-10-25', input: moved }),
      );
      await store.dispatch(
        updateCustomReminder({
          id,
          patch: { title: 'Call Dad', hour: 10, minute: 0 },
          date: '2026-10-21',
        }),
      );
      expect(slice(store).items[0].changed).toStrictEqual({
        '2026-10-25': moved,
      });
      store.dispatch(
        setRemindersRange({ from: '2026-10-21', to: '2026-10-25' }),
      );
      const days = selectDayReminders(store.getState());
      expect(days['2026-10-21']).toEqual([
        expect.objectContaining({ id, title: 'Call Dad', hour: 10, minute: 0 }),
      ]);
      expect(days['2026-10-25']).toEqual([
        expect.objectContaining({ id, ...moved }),
      ]);
    });

    it('daily → monthly keeps only the days the monthly rule has', async () => {
      const { id } = await add(store, { start: '2026-10-21' });
      for (const date of ['2026-10-21', '2026-10-22', '2026-11-21'])
        await store.dispatch(editCustomReminderDay({ id, date, input: moved }));
      await store.dispatch(
        updateCustomReminder({ id, patch: { repeat: 'monthly' } }),
      );
      expect(Object.keys(slice(store).items[0].changed).sort()).toEqual([
        '2026-10-21',
        '2026-11-21',
      ]);
    });

    it("create and update can't set changed days", async () => {
      const injected = { '2026-10-05': { title: 'X', hour: 1, minute: 1 } };
      const saved = await add(store, { changed: injected });
      expect(saved.changed).toStrictEqual({});
      await store.dispatch(
        updateCustomReminder({
          id: saved.id,
          patch: { hour: 8, changed: injected },
        }),
      );
      expect(slice(store).items[0]).toMatchObject({ hour: 8, changed: {} });
    });

    it('an update drops an entry left on a skipped day (skips counted)', async () => {
      const s = configureStore({
        reducer: { customReminders: customRemindersReducer },
        preloadedState: {
          customReminders: {
            items: [
              {
                id: 'old',
                title: 'Call Mom',
                hour: 9,
                minute: 30,
                repeat: 'daily',
                calendar: 'gregorian',
                start: '2026-10-01',
                skipped: ['2026-10-03'],
                changed: {
                  '2026-10-03': { title: 'Gone', hour: 1, minute: 0 },
                  '2026-10-04': { title: 'Kept', hour: 1, minute: 0 },
                },
              },
            ],
            range: null,
            error: null,
          },
        },
      });
      await s.dispatch(updateCustomReminder({ id: 'old', patch: { hour: 7 } }));
      expect(s.getState().customReminders.items[0].changed).toStrictEqual({
        '2026-10-04': { title: 'Kept', hour: 1, minute: 0 },
      });
    });
  });

  describe('error', () => {
    it('a rejection leaves its message as the error; the next change clears it', async () => {
      await store.dispatch(createCustomReminder({ ...valid, title: '' }));
      expect(slice(store).error).toBe('Give it a title');
      const pending = store.dispatch(createCustomReminder(valid));
      expect(slice(store).error).toBeNull();
      await pending;
      expect(slice(store).error).toBeNull();
    });

    it('clearCustomReminderError clears it', async () => {
      await store.dispatch(createCustomReminder({ ...valid, title: '' }));
      store.dispatch(clearCustomReminderError());
      expect(slice(store).error).toBeNull();
    });
  });
});

describe('selectDayReminders', () => {
  let store;
  beforeEach(() => {
    store = makeStore();
    datesFor.mockClear();
  });

  const days = () => selectDayReminders(store.getState());
  const datesOf = (id) =>
    Object.keys(days())
      .filter((date) => days()[date].some((row) => row.id === id))
      .sort();
  const range = (from, to) => store.dispatch(setRemindersRange({ from, to }));

  it('is empty until the Calendar tab sets a range', async () => {
    await add(store);
    expect(days()).toEqual({});
  });

  it('once: just its day, when in range', async () => {
    const r = await add(store, { repeat: 'once', start: '2026-10-21' });
    range('2026-10-01', '2026-10-31');
    expect(datesOf(r.id)).toEqual(['2026-10-21']);
    range('2026-11-01', '2026-11-30');
    expect(days()).toEqual({});
  });

  it('daily: every day from its start to the end of the range, skipped days left out', async () => {
    const r = await add(store, { repeat: 'daily', start: '2026-10-28' });
    await store.dispatch(
      skipCustomReminderDay({ id: r.id, date: '2026-10-30' }),
    );
    range('2026-10-01', '2026-11-02');
    expect(datesOf(r.id)).toEqual([
      '2026-10-28',
      '2026-10-29',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  // the rules themselves are lib/jewish-calendar's (reminder-occurrences.spec.ts); one case shows
  // the selector goes by them
  it("monthly, Gregorian: the 31st falls on a shorter month's last day", async () => {
    const r = await add(store, { repeat: 'monthly', start: '2026-01-31' });
    range('2026-10-01', '2027-02-28');
    expect(datesOf(r.id)).toEqual([
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
    ]);
  });

  it('sorts a day by time and gives each row { id, title, hour, minute, reminder }', async () => {
    const late = await add(store, { title: 'Late', hour: 21, minute: 0 });
    const early = await add(store, { title: 'Early', hour: 6, minute: 45 });
    const mid = await add(store, { title: 'Mid', hour: 6, minute: 50 });
    range('2026-10-21', '2026-10-21');
    const row = (r) => ({
      id: r.id,
      title: r.title,
      hour: r.hour,
      minute: r.minute,
      reminder: r,
    });
    expect(days()).toStrictEqual({
      '2026-10-21': [row(early), row(mid), row(late)],
    });
    expect(days()['2026-10-21'][0].reminder).toBe(slice(store).items[1]);
  });

  it("works out again only a changed reminder's days; the others' are reused", async () => {
    const a = await add(store, { title: 'A' });
    const b = await add(store, { title: 'B', repeat: 'monthly' });
    range('2026-10-01', '2026-12-31');
    days();
    expect(datesFor).toHaveBeenCalledTimes(2);

    await store.dispatch(
      updateCustomReminder({ id: a.id, patch: { hour: 7 } }),
    );
    const after = days();
    expect(datesFor).toHaveBeenCalledTimes(3);
    expect(datesFor.mock.calls[2][0]).toMatchObject({ id: a.id, hour: 7 });
    expect(after['2026-10-01'].map((r) => r.id)).toEqual([a.id, b.id]);

    // the same state twice: the memoized result, nothing worked out
    expect(days()).toBe(after);
    expect(datesFor).toHaveBeenCalledTimes(3);

    // a new range works out every reminder's days again
    range('2027-01-01', '2027-01-31');
    days();
    expect(datesFor).toHaveBeenCalledTimes(5);
  });

  describe('changed days', () => {
    const editDay = (id, date, input) =>
      store.dispatch(editCustomReminderDay({ id, date, input }));

    it("a changed day's row has its own title and time, sorted by them", async () => {
      const series = await add(store); // daily 'Call Mom' 09:30
      const other = await add(store, { title: 'Other', hour: 10, minute: 0 });
      await editDay(series.id, '2026-10-21', {
        title: 'Moved',
        hour: 11,
        minute: 5,
      });
      range('2026-10-21', '2026-10-22');
      const [seriesNow, otherNow] = slice(store).items;
      expect(days()).toStrictEqual({
        '2026-10-21': [
          {
            id: other.id,
            title: 'Other',
            hour: 10,
            minute: 0,
            reminder: otherNow,
          },
          {
            id: series.id,
            title: 'Moved',
            hour: 11,
            minute: 5,
            reminder: seriesNow,
          },
        ],
        '2026-10-22': [
          {
            id: series.id,
            title: 'Call Mom',
            hour: 9,
            minute: 30,
            reminder: seriesNow,
          },
          {
            id: other.id,
            title: 'Other',
            hour: 10,
            minute: 0,
            reminder: otherNow,
          },
        ],
      });
      // the series itself is untouched: its row's reminder still has its own title and time
      expect(days()['2026-10-21'][1].reminder).toMatchObject({
        title: 'Call Mom',
        hour: 9,
        minute: 30,
      });
    });

    it("a changed day still counts once: the day's count is unchanged", async () => {
      const series = await add(store);
      range('2026-10-01', '2026-10-31');
      const before = Object.keys(days()).length;
      await editDay(series.id, '2026-10-21', {
        title: 'Moved',
        hour: 11,
        minute: 5,
      });
      expect(Object.keys(days())).toHaveLength(before);
      expect(days()['2026-10-21']).toHaveLength(1);
    });

    it("editing one reminder's day leaves the others' days reused", async () => {
      const a = await add(store, { title: 'A' });
      await add(store, { title: 'B', repeat: 'monthly' });
      range('2026-10-01', '2026-12-31');
      days();
      expect(datesFor).toHaveBeenCalledTimes(2);
      await editDay(a.id, '2026-10-21', { title: 'Moved', hour: 7, minute: 0 });
      days();
      expect(datesFor).toHaveBeenCalledTimes(3);
      expect(datesFor.mock.calls[2][0]).toMatchObject({ id: a.id });
    });
  });
});
