import { StyleSheet, Text, View } from 'react-native';
import { VERSION } from '../../../config/version';
import { useAppTheme } from '../../../hooks/useAppTheme';

const formatBuilt = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// This frontend's version and build time (src/config/version.js) — what's deployed.
export default function VersionInfo({ style }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.box, style]} accessibilityLabel="Version">
      <Text style={[styles.app, { color: colors.textMuted }]}>
        Personal Copilot {VERSION.frontend ?? 'dev'}
      </Text>
      {VERSION.builtAt ? (
        <Text style={[styles.details, { color: colors.textFaint }]}>
          built {formatBuilt(VERSION.builtAt)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 2, paddingVertical: 8 },
  app: { fontSize: 12, fontWeight: '600' },
  details: { fontSize: 11 },
});
