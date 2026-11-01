import UpdateSheet from './UpdateSheet';

// The sheet at each step of an update, in a state of its own: its buttons do nothing here.
const LATEST = {
  version: '0.7.0',
  notes: ['The whole app in Hebrew', 'A Settings tab'],
};
const step = (download, language) => ({
  language,
  state: {
    appUpdate: {
      latest: LATEST,
      sheetOpen: true,
      download: { status: 'idle', written: 0, total: 0, ...download },
    },
  },
});
const DOWNLOADING = { status: 'downloading', written: 18e6, total: 42e6 };
const READY = { status: 'ready', written: 42e6, total: 42e6 };
const FAILED = { status: 'failed' };

export default { component: UpdateSheet };

export const Available = { parameters: step() };
export const Downloading = { parameters: step(DOWNLOADING) };
export const Ready = { parameters: step(READY) };
export const Failed = { parameters: step(FAILED) };

export const AvailableHebrew = { parameters: step({}, 'he') };
export const DownloadingHebrew = { parameters: step(DOWNLOADING, 'he') };
export const ReadyHebrew = { parameters: step(READY, 'he') };
export const FailedHebrew = { parameters: step(FAILED, 'he') };
