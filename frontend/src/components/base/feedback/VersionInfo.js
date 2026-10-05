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

// The app's and this frontend's versions and build time (src/config/version.js) — what's deployed.
export default function VersionInfo({ style }) {
  const { colors } = useAppTheme();
  const details = [
    `Frontend ${VERSION.frontend ?? 'dev'}`,
    VERSION.builtAt ? `built ${formatBuilt(VERSION.builtAt)}` : null,
  ].filter(Boolean);

  return (
    <View style={[styles.box, style]} accessibilityLabel="Version">
      <Text style={[styles.app, { color: colors.textMuted }]}>
        Personal Copilot {VERSION.app ?? 'dev'}
      </Text>
      <Text style={[styles.details, { color: colors.textFaint }]}>
        {details.join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 2, paddingVertical: 8 },
  app: { fontSize: 12, fontWeight: '600' },
  details: { fontSize: 11 },
});
