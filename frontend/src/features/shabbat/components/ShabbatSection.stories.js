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
  parameters: { language: 'en' },
  args: { shabbat: SHABBAT, now: NOW },
  argTypes: { onRetry: { action: 'retry' } },
};

export const ThisWeek = {};

export const Hebrew = { parameters: { language: 'he' } };

// Shabbat in progress: Shabbat Shalom, counting down to Havdalah.
const SATURDAY = new Date('2026-10-31T12:00:00+02:00');
export const ShabbatShalom = { args: { now: SATURDAY } };
export const ShabbatShalomHebrew = {
  parameters: { language: 'he' },
  args: { now: SATURDAY },
};

// No times yet, or none to be had.
export const Locating = { args: { shabbat: null } };
export const LocationOff = {
  args: { shabbat: null, locationStatus: 'denied' },
};
export const LoadFailed = { args: { shabbat: null, loadFailed: true } };
export const LocationOffHebrew = {
  parameters: { language: 'he' },
  args: { shabbat: null, locationStatus: 'denied' },
};
export const LastKnownLocationHebrew = {
  parameters: { language: 'he' },
  args: { locationStatus: 'failed' },
};
