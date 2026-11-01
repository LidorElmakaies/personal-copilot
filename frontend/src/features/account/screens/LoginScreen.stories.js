import LoginScreen from './LoginScreen';

// Logging in here would call Gateway, as in the app.
export default {
  component: LoginScreen,
  parameters: { layout: 'fullscreen' },
};

export const English = {};
export const Hebrew = { parameters: { language: 'he' } };

// After a refresh the server refused (authSlice's notice).
export const SessionEndedHebrew = {
  parameters: {
    language: 'he',
    state: { auth: { status: 'idle', notice: 'auth.sessionEnded' } },
  },
};
