import { ShabbatCalendar } from '../../../lib/jewish-calendar';
import ShabbatSection from './ShabbatSection';

// This week's times from Tuesday 27 October 2026 in Tel Aviv (the Hebrew canvas's Home), as
// calendarService computes them.
const NOW = new Date('2026-10-27T16:42:07+02:00');
const SHABBAT = JSON.parse(
  JSON.stringify(
    new ShabbatCalendar().current(
      { latitude: 32.0853, longitude: 34.7818 },
      NOW,
    ),
  ),
);

export default {
  component: ShabbatSection,
  args: { shabbat: SHABBAT, now: NOW },
  argTypes: { onRetry: { action: 'retry' } },
};

export const ThisWeek = {};

export const Hebrew = { parameters: { language: 'he' } };
