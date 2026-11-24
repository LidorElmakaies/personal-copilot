import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Provider } from 'react-redux';
import languageReducer, { setLanguage } from '../../i18n/languageSlice';
import { LanguageOverride } from '../../i18n/translate';
import PhotoViewer from './PhotoViewer';

// Reanimated and gesture-handler are native under Jest: a shared value is a ref, an animated style is
// computed on render, the gestures do nothing (their arithmetic is photoZoom.spec.js's).
jest.mock('react-native-reanimated', () => {
  const { useRef } = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    cancelAnimation: () => {},
    Easing: { out: () => {}, cubic: () => {} },
    runOnJS: (fn) => fn,
    useAnimatedReaction: () => {},
    useAnimatedStyle: (style) => style(),
    useSharedValue: (value) => useRef({ value }).current,
    withSpring: (value) => value,
    withTiming: (value) => value,
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const gesture = new Proxy(
    {},
    { get: (_, key) => (key === 'then' ? undefined : () => gesture) },
  );
  return {
    Gesture: {
      Pan: () => gesture,
      Pinch: () => gesture,
      Simultaneous: () => gesture,
      Tap: () => gesture,
    },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: View,
  };
});
jest.mock('../../theme/useAppTheme', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000' }) }),
}));
jest.mock('./ConfirmModal', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ visible, onConfirm }) =>
    visible ? <Text onPress={onConfirm}>confirm</Text> : null;
});

const PHOTOS = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  source: { uri: `file:///${id}.jpg` },
}));

// Removing a photo removes it from the list, as the sheet does.
function Harness({ index, photos, onClose, onRemove }) {
  const [list, setList] = useState(photos);
  return (
    <PhotoViewer
      photos={list}
      index={index}
      onClose={onClose}
      onRemove={
        onRemove &&
        ((id) => {
          onRemove(id);
          setList(list.filter((p) => p.id !== id));
        })
      }
    />
  );
}

async function renderViewer({ language = 'en', photos = PHOTOS, ...props }) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onClose = jest.fn();
  await render(
    <Provider store={store}>
      <LanguageOverride.Provider value={language}>
        <Harness photos={photos} onClose={onClose} {...props} />
      </LanguageOverride.Provider>
    </Provider>,
  );
  const pager = screen.queryByTestId('photo-pager');
  if (pager) {
    await fireEvent(pager, 'layout', {
      nativeEvent: { layout: { width: 400, height: 700 } },
    });
  }
  return onClose;
}

const counter = () => screen.getByText(/ \/ \d$/).props.children;
const bigPhotos = () =>
  screen.getAllByRole('image').map((i) => i.props.accessibilityLabel);

describe('PhotoViewer', () => {
  it('is closed without an index', async () => {
    await renderViewer({ index: null });
    expect(screen.queryByTestId('photo-pager')).toBeNull();
  });

  it('opens on the photo pressed, loading only it and its neighbours', async () => {
    await renderViewer({ index: 1 });
    expect(counter()).toContain('2 / 4');
    expect(bigPhotos()).toEqual(['Photo 1', 'Photo 2', 'Photo 3']);
  });

  it('in Hebrew the photos run right to left', async () => {
    await renderViewer({ index: 0, language: 'he' });
    expect(counter()).toContain('1 / 4');
    expect(bigPhotos()).toEqual(['תמונה 2', 'תמונה 1']);
  });

  it('a thumbnail jumps to its photo', async () => {
    await renderViewer({ index: 0 });
    await fireEvent.press(screen.getByRole('button', { name: 'Photo 4' }));
    expect(counter()).toContain('4 / 4');
    expect(bigPhotos()).toEqual(['Photo 3', 'Photo 4']);
  });

  it('asks before removing; the last one removed shows the one before it', async () => {
    const onRemove = jest.fn();
    const onClose = await renderViewer({ index: 3, onRemove });
    await fireEvent.press(screen.getByTestId('photo-viewer-remove'));
    expect(onRemove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('confirm'));
    expect(onRemove.mock.calls).toEqual([['d']]);
    expect(counter()).toContain('3 / 3');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removing the only photo closes it', async () => {
    const onClose = await renderViewer({
      index: 0,
      photos: PHOTOS.slice(0, 1),
      onRemove: jest.fn(),
    });
    expect(screen.queryByRole('button', { name: 'Photo 1' })).toBeNull();
    await fireEvent.press(screen.getByTestId('photo-viewer-remove'));
    await fireEvent.press(screen.getByText('confirm'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('without onRemove there is no delete; the × closes', async () => {
    const onClose = await renderViewer({ index: 0 });
    expect(screen.queryByTestId('photo-viewer-remove')).toBeNull();
    await fireEvent.press(screen.getByTestId('photo-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
