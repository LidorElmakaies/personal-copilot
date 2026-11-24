import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsRTL, useTranslate } from '../../../i18n/translate';
import { useAppTheme } from '../../../theme/useAppTheme';

// A photo full screen, on black in both themes, swiped sideways to the others (the next one is on the
// left in Hebrew). `photos` `[{ id, source }]`, `index` the one it opens on (null: closed), `onClose`
// (the × or Back).
export default function PhotoViewer({ photos, index, onClose }) {
  const open = index !== null && index < photos.length;
  return (
    <Modal
      visible={open}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {open && <Pages photos={photos} first={index} onClose={onClose} />}
    </Modal>
  );
}

function Pages({ photos, first, onClose }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
  const [size, setSize] = useState(null);
  const [shown, setShown] = useState(first);
  const last = photos.length - 1;
  // The strip is always laid out left to right; in Hebrew the photos themselves are reversed.
  const placeOf = (i) => (rtl ? last - i : i);
  const row = rtl ? [...photos].reverse() : photos;

  const onScroll = (e) => {
    const place = Math.round(e.nativeEvent.contentOffset.x / size.width);
    setShown(placeOf(Math.max(0, Math.min(last, place))));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.viewerBg }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={translate('common.close')}
          testID="photo-viewer-close"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={26} color={colors.viewerText} />
        </Pressable>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.counter, { color: colors.viewerText }]}
        >
          {translate('photos.counter', { n: shown + 1, total: photos.length })}
        </Text>
        <View style={styles.close} />
      </View>
      <View
        style={styles.pages}
        testID="photo-viewer-pages"
        onLayout={(e) => setSize(e.nativeEvent.layout)}
      >
        {size && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: placeOf(first) * size.width, y: 0 }}
            scrollEventThrottle={16}
            onScroll={onScroll}
            testID="photo-viewer-scroll"
          >
            {row.map(({ id, source }, place) => {
              const i = placeOf(place);
              return (
                <View
                  key={id}
                  style={[
                    styles.page,
                    { width: size.width, height: size.height },
                  ]}
                >
                  <Ionicons
                    name="image-outline"
                    size={48}
                    color={colors.viewerMuted}
                    style={styles.placeholder}
                  />
                  {/* Only the photo shown and its neighbours are decoded. */}
                  {Math.abs(i - shown) <= 1 && (
                    <Image
                      source={source}
                      resizeMode="contain"
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={translate('photos.photo', {
                        n: i + 1,
                      })}
                      style={styles.image}
                    />
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
      {photos.length > 1 && (
        <Text style={[styles.hint, { color: colors.viewerMuted }]}>
          {translate('photos.swipeHint')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 44, paddingBottom: 40 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  counter: { fontSize: 15, fontWeight: '500' },
  pages: { flex: 1, direction: 'ltr' },
  page: { alignItems: 'center', justifyContent: 'center' },
  placeholder: { position: 'absolute' },
  image: { width: '100%', height: '100%' },
  hint: { fontSize: 13, textAlign: 'center', paddingTop: 12 },
});
