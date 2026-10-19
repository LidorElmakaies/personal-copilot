import { withLayoutContext } from 'expo-router';
import {
  createNavigatorFactory,
  TabRouter,
  useNavigationBuilder,
} from 'expo-router/react-navigation';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TabPager from '../base/layout/TabPager';

// Expo Router's Tabs, but the screens sit side by side in a TabPager: swipe between them, and a tab
// tapped slides there too. `order` is the swipe order (tab names; a tab left out — Admin for
// non-admins — is never swiped to, and a direct link to it shows it over the pager with the swipe
// off). `canEnter(name)` false: a swipe onto it springs back and calls `onBlocked(name)`.
// `tabBar({ navigation, activeName })` draws the bar; `activeName` is the tab mostly in view.
// A screen mounts when it's shown or next to the one shown (so a drag finds it drawn) and then
// stays mounted, as with Tabs.
function SwipeTabNavigator({
  id,
  initialRouteName,
  backBehavior,
  UNSTABLE_routeNamesChangeBehavior,
  children,
  layout,
  screenListeners,
  screenOptions,
  screenLayout,
  UNSTABLE_router,
  order,
  canEnter,
  onBlocked,
  tabBar,
}) {
  const { state, descriptors, navigation, NavigationContent } =
    useNavigationBuilder(TabRouter, {
      id,
      initialRouteName,
      backBehavior,
      UNSTABLE_routeNamesChangeBehavior,
      children,
      layout,
      screenListeners,
      screenOptions,
      screenLayout,
      UNSTABLE_router,
    });
  const focused = state.routes[state.index];
  const routes = order
    .map((name) => state.routes.find((r) => r.name === name))
    .filter(Boolean);
  const page = routes.findIndex((r) => r.key === focused.key);
  const onPager = page !== -1;
  const [inView, setInView] = useState(null);
  const [visited, setVisited] = useState(() => new Set([focused.key]));
  useEffect(() => {
    setVisited((v) => (v.has(focused.key) ? v : new Set(v).add(focused.key)));
  }, [focused.key]);

  const keys = routes.map((r) => r.key).join();
  // New elements only when navigation changes: a drag re-renders this (the bar follows it), and
  // the screens needn't re-render with it.
  const pages = useMemo(
    () => routes.map((r) => descriptors[r.key].render()),
    [descriptors, keys],
  );
  const mounted = routes.map(
    (r, i) => visited.has(r.key) || (onPager && Math.abs(i - page) <= 1),
  );

  return (
    <NavigationContent>
      <View style={styles.root}>
        <View style={styles.root}>
          <TabPager
            index={onPager ? page : 0}
            count={routes.length}
            renderPage={(i) => pages[i]}
            mounted={mounted}
            enabled={onPager}
            onMove={(i) => setInView(routes[i]?.name ?? null)}
            onSwipe={(i) => navigation.navigate(routes[i].name)}
            canEnter={(i) => canEnter(routes[i].name)}
            onBlocked={(i) => onBlocked(routes[i].name)}
          />
          {onPager ? null : (
            <View style={StyleSheet.absoluteFill}>
              {descriptors[focused.key].render()}
            </View>
          )}
        </View>
        {tabBar({
          navigation,
          activeName: onPager ? (inView ?? focused.name) : focused.name,
        })}
      </View>
    </NavigationContent>
  );
}

const SwipeTabs = withLayoutContext(
  createNavigatorFactory(SwipeTabNavigator)().Navigator,
);

export default SwipeTabs;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
