import { createAction } from '@reduxjs/toolkit';

// What the reconcile planned for the candle-lighting reminder: { 'YYYY-MM-DD': atMs }, a firing time
// per candle lighting's date (Israel), kept by the shabbat slice (persisted) so a week whose
// reminder has gone off doesn't get a second one — see schedulePlan's doneCandleDates.
export const candleFiringsPlanned = createAction(
  'reminders/candleFiringsPlanned',
);
