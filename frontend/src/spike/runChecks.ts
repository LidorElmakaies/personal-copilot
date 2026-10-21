// SPIKE (R1.1) — throwaway. Runs the copied calendar lib against answers fetched from Gateway
// (expected.json). Shared by app/spike.js (Hermes) and nodeCheck.mjs (Node).
import { MonthCalendar } from './jewish-calendar/month-calendar';
import { ShabbatCalendar } from './jewish-calendar/shabbat-calendar';

export interface CheckResult {
  name: string;
  pass: boolean;
  ms: number;
  detail: string;
}

const clock = () =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

// The first path where the two differ, or null. Both sides as JSON (Dates → ISO strings).
function firstDiff(actual: unknown, expected: unknown, path = ''): string | null {
  if (
    actual === null ||
    expected === null ||
    typeof actual !== 'object' ||
    typeof expected !== 'object'
  ) {
    return actual === expected
      ? null
      : `${path || '(root)'}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`;
  }
  const a = actual as Record<string, unknown>;
  const e = expected as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(e)]);
  for (const k of keys) {
    const d = firstDiff(a[k], e[k], path ? `${path}.${k}` : k);
    if (d) return d;
  }
  return null;
}

function check(name: string, expected: unknown, run: () => unknown): CheckResult {
  const start = clock();
  try {
    const result = run();
    const ms = clock() - start;
    const diff = firstDiff(JSON.parse(JSON.stringify(result)), expected);
    return { name, pass: !diff, ms, detail: diff ?? 'identical' };
  } catch (e) {
    const err = e as Error;
    return {
      name,
      pass: false,
      ms: clock() - start,
      detail: `threw ${err?.message}\n${err?.stack ?? ''}`,
    };
  }
}

export function runChecks(expected: any): CheckResult[] {
  const results: CheckResult[] = [];
  const now = new Date(expected.now);
  const shabbat = new ShabbatCalendar();
  const months = new MonthCalendar();
  for (const [name, point] of Object.entries<any>(expected.points)) {
    const location = { latitude: point.lat, longitude: point.lon };
    results.push(
      check(`${name} shabbat @ ${expected.now}`, point.shabbat, () =>
        shabbat.current(location, now),
      ),
    );
    for (const [ym, want] of Object.entries<any>(point.months)) {
      const [year, month] = ym.split('-').map(Number);
      results.push(
        check(`${name} month ${ym}`, want, () => months.month(location, year, month)),
      );
    }
  }
  return results;
}

// The Hermes-specific primitives the lib leans on.
export function runtimeProbes(): CheckResult[] {
  const probe = (name: string, run: () => string): CheckResult => {
    const start = clock();
    try {
      return { name, pass: true, ms: clock() - start, detail: run() };
    } catch (e) {
      const err = e as Error;
      return {
        name,
        pass: false,
        ms: clock() - start,
        detail: `threw ${err?.message}\n${err?.stack ?? ''}`,
      };
    }
  };
  return [
    probe('typeof BigInt', () => {
      const t = typeof BigInt;
      if (t !== 'function') throw new Error(`typeof BigInt is ${t}`);
      return `${t}, 2n**64n = ${(BigInt(2) ** BigInt(64)).toString()}`;
    }),
    probe('Intl Asia/Jerusalem formatToParts', () => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
      }).formatToParts(new Date());
      return JSON.stringify(parts);
    }),
    probe('Intl Asia/Jerusalem fixed instant', () => {
      // 2026-10-21T09:00Z is 12:00 in Israel (IDT, UTC+3) — throws unless the zone is honored.
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date('2026-10-21T09:00:00Z'));
      const hm = ['hour', 'minute']
        .map((t) => parts.find((p) => p.type === t)?.value)
        .join(':');
      if (hm !== '12:00') throw new Error(`got ${hm}, want 12:00`);
      return hm;
    }),
  ];
}
