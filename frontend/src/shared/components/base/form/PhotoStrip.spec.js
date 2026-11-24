import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, { setLanguage } from '../../../i18n/languageSlice';
import PhotoStrip from './PhotoStrip';

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000' }) }),
}));

const PHOTOS = ['a', 'b', 'c'].map((id) => ({
  id,
  source: { uri: `file:///${id}.jpg` },
}));

async function renderStrip(props) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  await render(
    <Provider store={store}>
      <PhotoStrip photos={PHOTOS} {...props} />
    </Provider>,
  );
}

describe('PhotoStrip', () => {
  it("a photo's × removes that photo", async () => {
    const onRemove = jest.fn();
    await renderStrip({ onRemove });
    await fireEvent.press(screen.getByLabelText('Remove photo 2'));
    expect(onRemove.mock.calls).toEqual([['b']]);
  });

  it('with no photos, only the add tile', async () => {
    const onAdd = jest.fn();
    await renderStrip({ photos: [], onAdd, onRemove: jest.fn() });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText('Add photos'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('a tap on a photo opens that one', async () => {
    const onPressPhoto = jest.fn();
    await renderStrip({ onPressPhoto });
    await fireEvent.press(screen.getByLabelText('Photo 2'));
    expect(onPressPhoto.mock.calls).toEqual([[1]]);
  });

  it('without handlers the photos are only shown', async () => {
    await renderStrip();
    expect(screen.getAllByRole('image')).toHaveLength(3);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
