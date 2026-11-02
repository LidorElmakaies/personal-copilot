import { ShabbatCalendar } from '../../../lib/jewish-calendar';
import CandleReminder from './CandleReminder';

// This week's candle lighting from Tuesday 27 October 2026 in Tel Aviv. The reminder itself is the
// app's own (on or off as saved): a tap opens its sheet, and Save there saves it, as in the app.
const NOW = new Date('2026-10-27T16:42:07+02:00');
const { candleLighting } = new ShabbatCalendar().current(
  { latitude: 32.0853, longitude: 34.7818 },
  NOW,
);

export default {
  component: CandleReminder,
  parameters: { language: 'en' },
  args: { candleLighting: new Date(candleLighting), now: NOW },
};

export const English = {};

export const Hebrew = { parameters: { language: 'he' } };
