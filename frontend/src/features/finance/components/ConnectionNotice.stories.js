import ConnectionNotice from './ConnectionNotice';

export default {
  component: ConnectionNotice,
  parameters: { language: 'en' },
  args: { reachable: false, waiting: 0 },
};

export const Unreachable = {};
// Unreachable wins: the "not sent" badges show what's waiting.
export const UnreachableWithWaiting = { args: { waiting: 2 } };
export const Waiting = { args: { reachable: true, waiting: 2 } };
export const OneWaiting = { args: { reachable: true, waiting: 1 } };
// Reachable with nothing waiting: no notice at all (an empty story).
export const AllSent = { args: { reachable: true, waiting: 0 } };
export const HebrewUnreachable = { parameters: { language: 'he' } };
export const HebrewWaiting = {
  parameters: { language: 'he' },
  args: { reachable: true, waiting: 2 },
};
export const HebrewOneWaiting = {
  parameters: { language: 'he' },
  args: { reachable: true, waiting: 1 },
};
