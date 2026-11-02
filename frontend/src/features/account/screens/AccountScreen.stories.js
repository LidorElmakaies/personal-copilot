import AccountScreen from './AccountScreen';

// Signed in with a made-up token (never sent: the profile is already here, and the cards' buttons
// dispatch nothing). Edit and Delete still open their forms. The build time shows in an APK only.
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdG9yeSIsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJkYW5hQGV4YW1wbGUuY29tIiwiZXhwIjo0MTAyNDQ0ODAwfQ.story';
const signedIn = (firstName, lastName) => ({
  auth: { accessToken: TOKEN, status: 'idle' },
  profile: {
    profile: { firstName, lastName, phone: '+972501234567' },
    status: 'succeeded',
    error: null,
  },
  notifications: { permission: 'granted', ready: true, busy: false },
});

export default {
  component: AccountScreen,
  parameters: { layout: 'fullscreen' },
};

export const English = {
  parameters: { language: 'en', state: signedIn('Dana', 'Cohen') },
};
export const Hebrew = {
  parameters: { language: 'he', state: signedIn('דנה', 'כהן') },
};

export const LoggedOutHebrew = {
  parameters: { language: 'he', state: { auth: { accessToken: null } } },
};
