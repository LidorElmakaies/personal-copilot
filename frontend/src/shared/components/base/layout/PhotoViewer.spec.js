import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, { setLanguage } from '../../../i18n/languageSlice';
import { LanguageOverride } from '../../../i18n/translate';
import PhotoViewer from './PhotoViewer';

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000' }) }),
}));

const PHOTOS = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  source: { uri: `file:///${id}.jpg` },
}));
const WIDTH = 400;

async function renderViewer({ language = 'en', ...props }) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onClose = jest.fn();
  await render(
    <Provider store={store}>
      <LanguageOverride.Provider value={language}>
        <PhotoViewer photos={PHOTOS} onClose={onClose} {...props} />
      </LanguageOverride.Provider>
    </Provider>,
  );
  const pages = screen.queryByTestId('photo-viewer-pages');
  if (pages) {
    await fireEvent(pages, 'layout', {
      nativeEvent: { layout: { width: WIDTH, height: 700 } },
    });
  }
  return onClose;
}

const scrollTo = (place) =>
  fireEvent(screen.getByTestId('photo-viewer-scroll'), 'scroll', {
    nativeEvent: { contentOffset: { x: place * WIDTH, y: 0 } },
  });
const counter = () => screen.getByText(/ \/ 4$/).props.children;
const startsAt = () =>
  screen.getByTestId('photo-viewer-scroll').props.contentOffset.x / WIDTH;

describe('PhotoViewer', () => {
  it('is closed without an index', async () => {
    await renderViewer({ index: null });
    expect(screen.queryByTestId('photo-viewer-pages')).toBeNull();
  });

  it('opens on the photo pressed, and counts the one swiped to', async () => {
    await renderViewer({ index: 1 });
    expect(startsAt()).toBe(1);
    expect(counter()).toContain('2 / 4');
    await scrollTo(2);
    expect(counter()).toContain('3 / 4');
  });

  it('in Hebrew the first photo is the rightmost', async () => {
    await renderViewer({ index: 0, language: 'he' });
    expect(startsAt()).toBe(3);
    expect(counter()).toContain('1 / 4');
    await scrollTo(2);
    expect(counter()).toContain('2 / 4');
  });

  it('loads only the photo shown and its neighbours', async () => {
    await renderViewer({ index: 0 });
    expect(screen.getAllByRole('image')).toHaveLength(2);
  });

  it('one photo has no swipe hint; the × closes', async () => {
    const onClose = await renderViewer({
      index: 0,
      photos: PHOTOS.slice(0, 1),
    });
    expect(screen.queryByText(/Swipe/)).toBeNull();
    await fireEvent.press(screen.getByTestId('photo-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
