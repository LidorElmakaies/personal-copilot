import { formatMinutes, MAX_TOTAL, plan } from './schedulePlan';

// The local scheduler's plan (task R3.2) — a few anchors; the full scenarios come with R3.5.

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
