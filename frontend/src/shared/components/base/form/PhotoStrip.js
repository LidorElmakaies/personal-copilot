import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useIsRTL, useTranslate } from '../../../i18n/translate';
import { useAppTheme } from '../../../theme/useAppTheme';

// Photos as thumbnails, each whole in its tile, in one row that scrolls sideways: a × on each with `onRemove(id)`, a dashed add
// tile at the end with `onAdd`, a tap on one calls `onPressPhoto(index)`. A photo just added scrolls the row to its end. `photos`
// `[{ id, source }]` (`source` as Image's); one still loading, or that won't load, shows an icon.
export default function PhotoStrip({ photos, onAdd, onRemove, onPressPhoto }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
  const scroll = useRef(null);
  const shown = useRef(photos.length);
  const tile = { backgroundColor: colors.card, borderColor: colors.cardBorder };

  const offset = useRef(0);
  const width = useRef(0);

  const onContentSizeChange = (contentWidth) => {
    const end = Math.max(0, contentWidth - width.current);
    if (photos.length > shown.current) {
      // Right to left, the row's end is x = 0: scrollToEnd goes to its start.
      // A frame later: Android first moves a right-to-left row to keep its place.
      requestAnimationFrame(() => {
        if (rtl) scroll.current?.scrollTo({ x: 0 });
        else scroll.current?.scrollToEnd();
      });
    } else if (photos.length < shown.current && offset.current > end) {
      // Android stays scrolled past the end of a row that got shorter.
      scroll.current?.scrollTo({ x: end });
    }
    shown.current = photos.length;
  };

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.x;
      }}
      onContentSizeChange={onContentSizeChange}
    >
      {photos.map(({ id, source }, i) => (
        <View key={id} style={styles.cell}>
          <Pressable
            onPress={() => onPressPhoto(i)}
            disabled={!onPressPhoto}
            accessibilityRole={onPressPhoto ? 'imagebutton' : 'image'}
            accessibilityLabel={translate('photos.photo', { n: i + 1 })}
            style={({ pressed }) => [
              styles.thumb,
              tile,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="image-outline"
              size={22}
              color={colors.textFaint}
              style={styles.placeholder}
            />
            <Image source={source} resizeMode="contain" style={styles.image} />
          </Pressable>
          {onRemove && (
            <Pressable
              onPress={() => onRemove(id)}
              accessibilityRole="button"
              accessibilityLabel={translate('photos.remove', { n: i + 1 })}
              style={({ pressed }) => [
                styles.remove,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.panel,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Ionicons name="close" size={14} color={colors.text} />
              </View>
            </Pressable>
          )}
        </View>
      ))}
      {onAdd && (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={translate('photos.add')}
          testID="photos-add"
          style={({ pressed }) => [
            styles.thumb,
            styles.add,
            { borderColor: colors.textMuted },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={26} color={colors.accent} />
        </Pressable>
      )}
    </ScrollView>
  );
}

const SIZE = 64;
// The × hangs over the thumbnail's corner by this much; also the gap between thumbnails.
const OVERHANG = 8;

const styles = StyleSheet.create({
  cell: { width: SIZE + OVERHANG, height: SIZE + OVERHANG },
  thumb: {
    width: SIZE,
    height: SIZE,
    marginTop: OVERHANG,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { borderStyle: 'dashed' },
  placeholder: { position: 'absolute' },
  image: { width: '100%', height: '100%' },
  // The 44 dp touch target; only the badge in its corner shows.
  remove: {
    position: 'absolute',
    top: 0,
    end: 0,
    width: 44,
    height: 44,
    alignItems: 'flex-end',
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
