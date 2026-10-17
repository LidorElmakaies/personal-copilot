import { monthAt, monthIndex } from './calendar';
import { pad2 } from './time';

// Made-up per-day reminders for the Admin tab's "Sample reminders on the calendar" switch, so the
// Calendar tab's busy-day display can be seen before real per-day reminders exist. Deterministic:
// the same month always gets the same ones. Remove with the switch once real reminders arrive.

const TITLES = [
  'Call Mom',
  'Buy challah',
  'Pick up kids',
  'Take medicine',
  'Water the plants',
  'Pay electricity bill',
  'Gym',
  'Team standup',
  'Dentist',
  'Laundry',
  'Walk the dog',
  'Order flowers',
  'Check on grandma',
  'Prepare cholent',
  'Read the parasha',
  'Charge the car',
  'Reply to Dana',
  'Pack for the trip',
  'Set the table',
  'Mincha',
  'Return library books',
  'Back up the laptop',
  'Study session',
  'Bake cookies',
];

// Per day of the month: how many. The 24th is busy; the 10th is extreme.
const COUNTS = { 5: 1, 10: 500, 12: 3, 19: 7, 24: 120, 29: 12 };

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// { 'YYYY-MM-DD': [{ id, title, at }] } for `months` months either side of { year, month }, each
// sorted by time; `at` is an ISO instant between 06:00 and 23:30 on the device's clock.
export function sampleReminders(around, months = 6) {
  const byDate = {};
  for (let offset = -months; offset <= months; offset++) {
    const index = monthIndex(around) + offset;
    const { year: y, month: m } = monthAt(index);
    for (const [day, count] of Object.entries(COUNTS)) {
      const date = `${y}-${pad2(m)}-${pad2(Number(day))}`;
      const random = seeded(index * 100 + Number(day));
      const list = Array.from({ length: count }, (_, i) => {
        const minutes = 6 * 60 + Math.floor(random() * (17.5 * 60));
        const at = new Date(y, m - 1, Number(day), 0, minutes);
        return {
          id: `${date}-${i}`,
          title: TITLES[Math.floor(random() * TITLES.length)],
          at: at.toISOString(),
        };
      });
      byDate[date] = list.sort((a, b) => a.at.localeCompare(b.at));
    }
  }
  return byDate;
}
