// Storybook's config: every *.stories.js under src/ — a component's or screen's stories sit next to
// it. Actions logs what a story's handlers are called with (`argTypes: { onPress: { action } }`).
module.exports = {
  stories: ['../src/**/*.stories.?(js|jsx|ts|tsx)'],
  deviceAddons: ['@storybook/addon-ondevice-actions'],
};
