import RegisterScreen from './RegisterScreen';

// Registering here would call Gateway, as in the app.
export default {
  component: RegisterScreen,
  parameters: { layout: 'fullscreen' },
};

export const English = {};
export const Hebrew = { parameters: { language: 'he' } };
