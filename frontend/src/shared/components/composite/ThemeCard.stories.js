import ThemeCard from './ThemeCard';

export default { component: ThemeCard };

// The app's real theme: the switch changes it, as in the app (StoryFrame sets it back to the
// system's on the next story).
export const English = {};

export const Hebrew = { parameters: { language: 'he' } };
