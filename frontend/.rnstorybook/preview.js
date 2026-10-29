import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from '../src/store';
import StoryFrame from './StoryFrame';

// Every story renders inside the app's real store, once its saved state is back (PersistGate, as in
// app/_layout.js), and a StoryFrame — the system's light/dark and a focused screen for hooks like
// useIsFocused. A screen's stories set `parameters: { layout: 'fullscreen' }` to drop its padding.
export default {
  decorators: [
    (Story, { parameters }) => (
      <Provider store={store}>
        <PersistGate persistor={persistor}>
          <StoryFrame fullscreen={parameters.layout === 'fullscreen'}>
            <Story />
          </StoryFrame>
        </PersistGate>
      </Provider>
    ),
  ],
};
