import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TabPager from './TabPager';

// The page strip's geometry once the pager knows its width: every page inside the strip, so the
// page in view is on-screen to accessibility (TalkBack, Maestro) whichever tab it is.

// Reanimated and gesture-handler are native under Jest: a shared value is a ref, an animated
// style is computed on render, the pan a no-op.
jest.mock('react-native-reanimated', () => {
  const { useRef } = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    cancelAnimation: () => {},
    Easing: { out: () => {}, cubic: () => {} },
    runOnJS: (fn) => fn,
    useAnimatedStyle: (style) => style(),
    useSharedValue: (value) => useRef({ value }).current,
    withTiming: (value) => value,
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const pan = new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : () => pan) });
  return {
    Gesture: { Pan: () => pan },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: View,
  };
});
jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: (_, key) => (key === 'spaceGradient' ? ['#000', '#111'] : '#000') }),
    isDark: true,
  }),
}));

const WIDTH = 400;
const COUNT = 3;

function renderPager(index) {
  return render(
    <TabPager
      index={index}
      count={COUNT}
      mounted={[true, true, true]}
      renderPage={(i) => <Text>page {i}</Text>}
      canEnter={() => true}
      onSwipe={() => {}}
      onBlocked={() => {}}
    />,
  );
}

// The page holding `page i`, and the strip holding the pages.
function geometry(i) {
  const page = screen.getByText(`page ${i}`).parent;
  return {
    page: StyleSheet.flatten(page.props.style),
    strip: StyleSheet.flatten(page.parent.props.style),
  };
}

// The pager measures itself on an ancestor of the page shown.
function layOut(shown, width) {
  let node = screen.getByText(`page ${shown}`);
  while (!node.props.onLayout) node = node.parent;
  return fireEvent(node, 'layout', { nativeEvent: { layout: { width, height: 800 } } });
}

test('before its width is known, only the page shown, in place', async () => {
  await renderPager(1);
  expect(screen.queryByText('page 0')).toBeNull();
  expect(screen.queryByText('page 2')).toBeNull();
  const { page, strip } = geometry(1);
  expect(page).toMatchObject({ width: '100%', left: 0 });
  expect(strip.width).toBeUndefined();
});

test.each([0, 1, 2])('laid out on page %i: the strip spans every page, the one shown on-screen', async (index) => {
  await renderPager(index);
  await layOut(index, WIDTH);
  for (let i = 0; i < COUNT; i++) {
    const { page, strip } = geometry(i);
    expect(strip.width).toBe(COUNT * WIDTH);
    expect(page).toMatchObject({ width: WIDTH, left: i * WIDTH });
    expect(page.left + page.width).toBeLessThanOrEqual(strip.width);
  }
  const { page, strip } = geometry(index);
  expect(strip.transform).toEqual([{ translateX: -index * WIDTH }]);
  // The page shown sits at the screen's left edge.
  expect(strip.transform[0].translateX + page.left).toBe(0);
});
