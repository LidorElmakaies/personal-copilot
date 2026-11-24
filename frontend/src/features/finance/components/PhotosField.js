import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import PhotoStrip from '../../../shared/components/base/form/PhotoStrip';
import PhotoViewer from '../../../shared/components/composite/PhotoViewer';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

const SOURCES = [
  { source: 'camera', icon: 'camera-outline' },
  { source: 'gallery', icon: 'images-outline' },
];

// The add sheet's photos (screen 2): the strip, its add tile asking "Camera / Gallery" under it (again
// closes the question), a tap on a photo opening it full screen. `photos` `[{ id, source }]`,
// `onChange(photos)`, `pickPhotos(source)` (`camera` | `gallery`) → the photos to add, `onAsk` when the
// question opens.
export default function PhotosField({ photos, onChange, pickPhotos, onAsk }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const [asking, setAsking] = useState(false);
  const [opened, setOpened] = useState(null);

  const toggle = () => {
    if (!asking) onAsk?.();
    setAsking(!asking);
  };
  const remove = (id) => onChange(photos.filter((p) => p.id !== id));
  const pick = (source) => {
    setAsking(false);
    onChange([...photos, ...pickPhotos(source)]);
  };

  return (
    <View style={styles.column}>
      <Text style={[styles.label, plain, { color: colors.textMuted }]}>
        {translate('photos.title')}
      </Text>
      <PhotoStrip
        photos={photos}
        onAdd={toggle}
        onRemove={remove}
        onPressPhoto={setOpened}
      />
      {asking && (
        <View style={styles.sources}>
          {SOURCES.map(({ source, icon }) => (
            <PillButton
              key={source}
              label={translate(`photos.${source}`)}
              icon={(color) => <Ionicons name={icon} size={16} color={color} />}
              onPress={() => pick(source)}
              style={styles.source}
            />
          ))}
        </View>
      )}
      <PhotoViewer
        photos={photos}
        index={opened}
        onClose={() => setOpened(null)}
        onRemove={remove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 6 },
  // As InputField's label.
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sources: { flexDirection: 'row', gap: 8, marginTop: 2 },
  source: { flex: 1, minHeight: 44 },
});
