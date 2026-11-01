import MonthStatus from './MonthStatus';

export default {
  component: MonthStatus,
  argTypes: { onRetry: { action: 'retry' } },
};

export const Locating = { args: { locationStatus: 'locating' } };
export const Loading = { args: { hasLocation: true } };
export const LocationOff = { args: { locationStatus: 'denied' } };
export const LoadFailed = { args: { hasLocation: true, loadFailed: true } };

export const LocationOffHebrew = {
  parameters: { language: 'he' },
  args: { locationStatus: 'denied' },
};
