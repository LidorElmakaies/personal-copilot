import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useIsRTL, useTranslate } from '../../i18n/translate';
import { useAppTheme } from '../../theme/useAppTheme';
import PhotoPager from '../base/layout/PhotoPager';
import ConfirmModal from './ConfirmModal';

// The gallery: a photo full screen, on black in both themes — `PhotoPager`'s swipe, zoom and drag down —
// with "2 / 8", a row of thumbnails to jump by, and a delete that asks first (with `onRemove(id)`).
// `photos` `[{ id, source }]`, `index` the one it opens on (null: closed), `onClose` (the ×, Back, dragged
// down, or the last photo removed).
export default function PhotoViewer({ photos, index, onClose, onRemove }) {
  const open = index !== null && photos.length > 0;
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {open && (
        <Gallery
          photos={photos}
          first={Math.min(index, photos.length - 1)}
          onClose={onClose}
          onRemove={onRemove}
        />
      )}
    </Modal>
  );
}

function Gallery({ photos, first, onClose, onRemove }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [wanted, setWanted] = useState(first);
  const [zoom, setZoom] = useState(1);
  const [asking, setAsking] = useState(false);
  const drag = useSharedValue(0);
  // The last one removed: the one before it shows.
  const shown = Math.min(wanted, photos.length - 1);
  const zoomed = zoom > 1;

  const remove = () => {
    setAsking(false);
    if (photos.length === 1) onClose();
    setWanted(shown);
    onRemove(photos[shown].id);
  };

  const fade = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - drag.value / 400),
  }));

  return (
    <GestureHandlerRootView style={styles.fill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.viewerBg },
          fade,
        ]}
      />
      <View style={styles.root}>
        <Animated.View style={[styles.bar, fade]}>
          <BarButton
            icon="close"
            label={translate('common.close')}
            onPress={onClose}
            testID="photo-viewer-close"
          />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.counter, { color: colors.viewerText }]}
          >
            {translate('photos.counter', {
              n: shown + 1,
              total: photos.length,
            })}
          </Text>
          {onRemove ? (
            <BarButton
              icon="trash-outline"
              label={translate('photos.remove', { n: shown + 1 })}
              onPress={() => setAsking(true)}
              testID="photo-viewer-remove"
            />
          ) : (
            <View style={styles.button} />
          )}
        </Animated.View>
        <PhotoPager
          photos={photos}
          shown={shown}
          onShow={setWanted}
          onZoom={setZoom}
          onClose={onClose}
          drag={drag}
        />
        {/* Keeps its room while zoomed, so the photo doesn't jump. */}
        <Animated.View style={[styles.bottom, fade]}>
          {zoomed ? (
            <Text style={[styles.zoom, { color: colors.viewerText }]}>
              {translate('photos.zoom', { zoom: zoom.toFixed(1) })}
            </Text>
          ) : (
            photos.length > 1 && (
              <Thumbnails photos={photos} shown={shown} onPress={setWanted} />
            )
          )}
        </Animated.View>
      </View>
      <ConfirmModal
        visible={asking}
        message={translate('photos.confirmRemove')}
        onConfirm={remove}
        onCancel={() => setAsking(false)}
      />
    </GestureHandlerRootView>
  );
}

function BarButton({ icon, label, onPress, testID }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={24} color={colors.viewerText} />
    </Pressable>
  );
}

// The photo shown is kept in the middle. Laid out left to right like the pager, reversed in Hebrew.
function Thumbnails({ photos, shown, onPress }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
  const scroll = useRef(null);
  const [width, setWidth] = useState(0);
  const last = photos.length - 1;
  const row = rtl ? [...photos].reverse() : photos;
  const place = rtl ? last - shown : shown;
  const jumped = useRef(false);

  useEffect(() => {
    if (!width) return undefined;
    // A frame later: the row must be laid out first.
    const frame = requestAnimationFrame(() => {
      scroll.current?.scrollTo({
        x: Math.max(0, (place + 0.5) * THUMB - width / 2),
        animated: jumped.current,
      });
      jumped.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [place, width]);

  return (
    <View
      style={styles.thumbnails}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbnailRow}
      >
        {row.map(({ id, source }, p) => {
          const i = rtl ? last - p : p;
          const on = i === shown;
          return (
            <Pressable
              key={id}
              onPress={() => onPress(i)}
              accessibilityRole="button"
              accessibilityLabel={translate('photos.photo', { n: i + 1 })}
              accessibilityState={{ selected: on }}
              style={styles.thumbPress}
            >
              <Image
                source={source}
                resizeMode="cover"
                style={[
                  styles.thumb,
                  { borderColor: on ? colors.viewerAccent : 'transparent' },
                  !on && styles.off,
                ]}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const THUMB = 48; // a thumbnail with its gap: the touch target

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1, paddingTop: 44, paddingBottom: 32 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  counter: { fontSize: 15, fontWeight: '500' },
  bottom: { height: 72, justifyContent: 'center' },
  zoom: { fontSize: 13, textAlign: 'center' },
  thumbnails: { direction: 'ltr' },
  thumbnailRow: { flexGrow: 1, justifyContent: 'center' },
  thumbPress: { width: THUMB, alignItems: 'center' },
  thumb: { width: 42, height: 56, borderRadius: 6, borderWidth: 2 },
  off: { opacity: 0.55 },
});
