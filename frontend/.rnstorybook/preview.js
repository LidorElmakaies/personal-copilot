import { useMemo } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from '../src/store';
import StoryFrame from './StoryFrame';

// Every story renders inside the app's real store, once its saved state is back (PersistGate, as in
// app/_layout.js), and a StoryFrame — the system's light/dark and a focused screen for hooks like
// useIsFocused. A screen's stories set `parameters: { layout: 'fullscreen' }` to drop its padding;
// a Hebrew story `parameters: { language: 'he' }`; one in a Redux state of its own
// `parameters: { state }` (OwnState, below).
export default {
  decorators: [
    (Story, { parameters }) => (
      <Provider store={store}>
        <PersistGate persistor={persistor}>
          <StoryFrame
            fullscreen={parameters.layout === 'fullscreen'}
            language={parameters.language}
          >
            {parameters.state ? (
              <OwnState state={parameters.state}>
                <Story />
              </OwnState>
            ) : (
              <Story />
            )}
          </StoryFrame>
        </PersistGate>
      </Provider>
    ),
  ],
};

// `parameters: { state }`: those slices over the real store's, read-only — the component's buttons
// dispatch nothing (an update's Install, Android's permission prompt).
function OwnState({ state, children }) {
  const own = useMemo(() => {
    let last, merged;
    return {
      getState() {
        if (store.getState() !== last) {
          last = store.getState();
          merged = { ...last, ...state };
        }
        return merged;
      },
      subscribe: store.subscribe,
      dispatch: () => {},
    };
  }, [state]);
  return <Provider store={own}>{children}</Provider>;
}
