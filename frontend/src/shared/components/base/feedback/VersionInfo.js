import { StyleSheet, Text, View } from 'react-native';
import { VERSION } from '../../../config/version';
import { shortDate } from '../../../i18n/format';
import { useTranslate } from '../../../i18n/translate';
import { useAppTheme } from '../../../theme/useAppTheme';
import { formatTime } from '../../../utils/time';

// This frontend's version and build time (src/shared/config/version.js) — what's deployed.
export default function VersionInfo({ style }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const builtAt = VERSION.builtAt ? new Date(VERSION.builtAt) : null;

  return (
    <View
      style={[styles.box, style]}
      accessibilityLabel={translate('version.label')}
    >
      <Text style={[styles.app, { color: colors.textMuted }]}>
        Personal Copilot {VERSION.frontend ?? 'dev'}
      </Text>
      {builtAt ? (
        <Text style={[styles.details, { color: colors.textFaint }]}>
          {translate('version.built', {
            date: shortDate(translate, builtAt, true),
            time: formatTime(builtAt),
          })}
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
