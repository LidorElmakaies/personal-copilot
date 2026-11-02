import AdminScreen from './AdminScreen';

// Signed in as an admin with a made-up token (never sent: the refresh dispatches nothing here).
// The services' answer is GET /admin/status's shape, checked at 14:03:27.
const ADMIN_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdG9yeSIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJleHAiOjQxMDI0NDQ4MDB9.story';
const USER_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdG9yeSIsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJkYW5hQGV4YW1wbGUuY29tIiwiZXhwIjo0MTAyNDQ0ODAwfQ.story';
const CHECKED_AT = '2026-11-02T12:03:27.000Z';
const gateway = {
  service: 'gateway',
  status: 'up',
  version: '0.3.0',
  builtAt: '2026-10-25T09:12:00.000Z',
  startedAt: '2026-10-31T08:00:00.000Z',
  latencyMs: 4,
};
const users = {
  service: 'users',
  status: 'up',
  version: '0.4.1',
  builtAt: '2026-10-28T17:40:00.000Z',
  startedAt: '2026-11-02T09:15:00.000Z',
  latencyMs: 11,
};
const usersDown = { service: 'users', status: 'down' };

const admin = (services, error = null) => ({
  auth: { accessToken: ADMIN_TOKEN, status: 'idle' },
  admin: { services, checkedAt: CHECKED_AT, loading: false, error },
});

export default {
  component: AdminScreen,
  parameters: { layout: 'fullscreen' },
};

export const English = {
  parameters: { language: 'en', state: admin([gateway, users]) },
};
export const Hebrew = {
  parameters: { language: 'he', state: admin([gateway, users]) },
};
export const DownHebrew = {
  parameters: { language: 'he', state: admin([gateway, usersDown]) },
};
export const FailedHebrew = {
  parameters: {
    language: 'he',
    state: admin(null, 'Request failed with status 502'),
  },
};
export const NotAdminHebrew = {
  parameters: {
    language: 'he',
    state: { auth: { accessToken: USER_TOKEN, status: 'idle' } },
  },
};
