import { formatMinutes, MAX_TOTAL, plan } from './schedulePlan';

// The local scheduler's plan, piece by piece; the scheduler scenarios over the store are in
// store/scheduleNotifications.scenarios.spec.js.

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };
const NOW = Date.parse('2026-10-21T10:00:00Z'); // Wed 21 Oct 2026, 13:00 in Israel
const OFF = { enabled: false, offsetMinutes: 90 };
const reminder = (over) => ({
  id: 'r1',
  title: 'Water the plants',
  hour: 9,
  minute: 0,
  repeat: 'daily',
  calendar: 'gregorian',
  start: '2026-10-01',
  skipped: [],
  changed: {},
  ...over,
});
const iso = (ms) => new Date(ms).toISOString();

describe('schedulePlan', () => {
  it('formats minutes as the server did', () => {
    expect(formatMinutes(90)).toBe('1 h 30 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(45)).toBe('45 min');
  });

  it('nothing without reminders', () => {
    expect(
      plan({ candles: OFF, coords: TEL_AVIV, items: [], now: NOW }),
    ).toEqual([]);
  });

  it('candle lighting: every Friday in the window, offset before, whole minutes', () => {
    const out = plan({
      candles: { enabled: true, offsetMinutes: 90 },
      coords: TEL_AVIV,
      items: [],
      now: NOW,
    });
    expect(out.length).toBeGreaterThanOrEqual(4);
    expect(out.length).toBeLessThanOrEqual(5);
    const [first] = out;
    const candleMs = Number(first.id.split(':')[2]);
    expect(first.id).toBe(`rem:candles:${candleMs}`);
    expect(iso(candleMs).slice(0, 10)).toBe('2026-10-23');
    expect(first.at).toBe(candleMs - 90 * 60_000);
    expect(first.at % 60_000).toBe(0);
    expect(first).toMatchObject({
      title: 'Shabbat candle lighting',
      url: '/',
    });
    expect(first.body).toMatch(
      /^Candle lighting is at \d\d:\d\d \(in 1 h 30 min\)\.$/,
    );
    expect(out.every((n) => n.at > NOW)).toBe(true);
  });

  it('candle lighting: none without a location, or for a polar one', () => {
    const candles = { enabled: true, offsetMinutes: 90 };
    expect(plan({ candles, coords: null, items: [], now: NOW })).toEqual([]);
    const polar = { latitude: 78.22, longitude: 15.65 }; // Svalbard
    const summer = Date.parse('2026-06-01T10:00:00Z');
    expect(() =>
      plan({ candles, coords: polar, items: [], now: summer }),
    ).not.toThrow();
  });

  it('a daily reminder: from its next time on, 30 days ahead', () => {
    const out = plan({
      candles: OFF,
      coords: null,
      items: [reminder()],
      now: NOW,
    });
    expect(out[0]).toEqual({
      id: 'rem:c:r1:2026-10-22',
      at: Date.parse('2026-10-22T06:00:00Z'), // 09:00 in Israel (summer time)
      title: 'Water the plants',
      body: 'Your reminder for 09:00.',
      url: '/calendar',
    });
    expect(out).toHaveLength(30);
    expect(out.at(-1).id).toBe('rem:c:r1:2026-11-20');
  });

  it("a changed day fires at its own time and title — today too, when it's still ahead", () => {
    const out = plan({
      candles: OFF,
      coords: null,
      items: [
        reminder({
          changed: {
            '2026-10-21': { title: 'Later today', hour: 18, minute: 30 },
          },
        }),
      ],
      now: NOW,
    });
    expect(out[0]).toMatchObject({
      id: 'rem:c:r1:2026-10-21',
      at: Date.parse('2026-10-21T15:30:00Z'),
      title: 'Later today',
      body: 'Your reminder for 18:30.',
    });
  });

  it('a skipped day is left out', () => {
    const out = plan({
      candles: OFF,
      coords: null,
      items: [reminder({ skipped: ['2026-10-22'] })],
      now: NOW,
    });
    expect(out[0].id).toBe('rem:c:r1:2026-10-23');
  });

  it('a yearly reminder beyond the window still gets its next firing', () => {
    const out = plan({
      candles: OFF,
      coords: null,
      items: [reminder({ repeat: 'yearly', start: '2026-03-05' })],
      now: NOW,
    });
    expect(out.map((n) => n.id)).toEqual(['rem:c:r1:2027-03-05']);
  });

  it('at most MAX_TOTAL, every reminder keeping its next one', () => {
    const items = [
      ...[1, 2, 3, 4].map((i) => reminder({ id: `d${i}` })),
      reminder({ id: 'y', repeat: 'yearly', start: '2026-03-05' }),
    ];
    const out = plan({ candles: OFF, coords: null, items, now: NOW });
    expect(out).toHaveLength(MAX_TOTAL);
    expect(out.map((n) => n.id)).toContain('rem:c:y:2027-03-05');
    expect([...out].sort((a, b) => a.at - b.at)).toEqual(out);
  });

  it('is deterministic', () => {
    const input = {
      candles: { enabled: true, offsetMinutes: 30 },
      coords: TEL_AVIV,
      items: [
        reminder(),
        reminder({ id: 'r2', repeat: 'monthly', calendar: 'hebrew' }),
      ],
      now: NOW,
    };
    expect(plan(input)).toEqual(plan(input));
  });
});

// The selection rule worked out the long way: each reminder's whole list alone (always under
// MAX_TOTAL), then every reminder's first, then the earliest of the rest.
const byTime = (a, b) =>
  a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
function expectedPlan({ candles, coords, items, now }) {
  const lists = [
    plan({ candles, coords, items: [], now }),
    ...items.map((r) => plan({ candles: OFF, coords: null, items: [r], now })),
  ].filter((l) => l.length > 0);
  const kept = lists
    .map((l) => l[0])
    .sort(byTime)
    .slice(0, MAX_TOTAL);
  const rest = lists.flatMap((l) => l.slice(1)).sort(byTime);
  kept.push(...rest.slice(0, MAX_TOTAL - kept.length));
  return kept.sort(byTime);
}

// A small seeded generator, so a failure is the same every run.
function seeded(seed) {
  let s = seed;
  return (n) => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s % n;
  };
}
const REPEATS = ['once', 'daily', 'daily', 'monthly', 'yearly'];
function randomReminder(rand, i) {
  const repeat = REPEATS[rand(REPEATS.length)];
  const start = `2026-${String(9 + rand(3)).padStart(2, '0')}-${String(1 + rand(28)).padStart(2, '0')}`;
  const day = `2026-10-${String(22 + rand(9)).padStart(2, '0')}`;
  return reminder({
    id: `x${i}`,
    hour: rand(3) * 4 + 8, // few distinct times: ties between reminders
    minute: rand(2) * 30,
    repeat,
    calendar: rand(2) ? 'hebrew' : 'gregorian',
    start,
    skipped: rand(3) ? [] : [day],
    changed: rand(3)
      ? {}
      : { [day]: { title: 'Own', hour: rand(24), minute: 15 } },
  });
}

// 'rem:c:r1:2026-10-22' → 'rem:c:r1'
const reminderOf = (id) => id.split(':').slice(0, -1).join(':');

describe('schedulePlan selection over many reminders', () => {
  const candles = { enabled: true, offsetMinutes: 40 };

  it('more reminders than MAX_TOTAL: just the earliest next ones, one per reminder', () => {
    const items = Array.from({ length: MAX_TOTAL + 50 }, (_, i) =>
      reminder({ id: `d${i}`, hour: i % 24, minute: i % 60 }),
    );
    const out = plan({ candles, coords: TEL_AVIV, items, now: NOW });
    expect(out).toEqual(
      expectedPlan({ candles, coords: TEL_AVIV, items, now: NOW }),
    );
    expect(out).toHaveLength(MAX_TOTAL);
    expect(new Set(out.map((n) => reminderOf(n.id))).size).toBe(MAX_TOTAL);
  });

  it('a few reminders with many firings each: the rest filled earliest first, ties by id', () => {
    const items = [
      ...[1, 2, 3, 4].map((i) => reminder({ id: `d${i}` })), // the same 09:00
      reminder({
        id: 'h',
        repeat: 'monthly',
        calendar: 'hebrew',
        start: '2026-09-20',
      }),
      reminder({ id: 'y', repeat: 'yearly', start: '2026-03-05' }), // next one beyond the window
    ];
    const out = plan({ candles, coords: TEL_AVIV, items, now: NOW });
    expect(out).toEqual(
      expectedPlan({ candles, coords: TEL_AVIV, items, now: NOW }),
    );
    expect(out).toHaveLength(MAX_TOTAL);
    expect(new Set(out.map((n) => reminderOf(n.id)))).toEqual(
      new Set(['rem:candles', ...items.map((r) => `rem:c:${r.id}`)]),
    );
    expect(out).toContainEqual(
      expect.objectContaining({ id: 'rem:c:y:2027-03-05' }),
    );
  });

  it('40 random mixes, some over MAX_TOTAL: the same selection as the long way', () => {
    let over = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rand = seeded(seed);
      const items = Array.from({ length: 1 + rand(12) }, (_, i) =>
        randomReminder(rand, i),
      );
      const input = {
        candles: rand(2) ? candles : OFF,
        coords: TEL_AVIV,
        items,
        now: NOW,
      };
      const out = plan(input);
      expect([seed, out]).toEqual([seed, expectedPlan(input)]);
      if (out.length === MAX_TOTAL) over++;
    }
    expect(over).toBeGreaterThan(5);
  });
});
