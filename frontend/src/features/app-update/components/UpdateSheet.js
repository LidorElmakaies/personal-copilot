import { Image, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import Alert from '../../../shared/components/base/feedback/Alert';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import { VERSION } from '../../../shared/config/version';
import {
  useLanguage,
  usePlainInHebrew,
  useTranslate,
} from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  cancelUpdateDownload,
  dismissUpdate,
  installUpdate,
} from '../store/appUpdateSlice';

const ICON = require('../../../../assets/images/icon.png');

const mb = (bytes) => Math.round(bytes / 1e6);

// Android's monospace has no Hebrew letters: its fallback spaces them out. English only.
const useMono = () => (useLanguage() === 'en' ? styles.mono : null);

// Composite component (BottomSheet/GradientButton/Alert) — the APK's "new version" sheet (mockups
// U2, U2a–c). Opens by itself once per version (appUpdateSlice); UpdateChip on Home reopens it.
// Later, a drag down or a tap outside close it — a running download carries on.
export default function UpdateSheet() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const mono = useMono();
  const { latest, sheetOpen, download } = useSelector(
    (state) => state.appUpdate,
  );
  const later = () => dispatch(dismissUpdate());
  const install = () => dispatch(installUpdate());

  const ready = download.status === 'ready';
  const subtitle =
    ready && download.total > 0
      ? translate('update.downloaded', { mb: mb(download.total) })
      : translate('update.youHave', { version: VERSION.frontend ?? 'dev' });

  return (
    <BottomSheet visible={sheetOpen && !!latest} onClose={later}>
      {latest ? (
        <View style={styles.body}>
          <View style={styles.head}>
            <Image source={ICON} style={styles.icon} />
            <View style={styles.headText}>
              <Text style={[styles.title, { color: colors.text }]}>
                {translate(ready ? 'update.ready' : 'update.available', {
                  version: latest.version,
                })}
              </Text>
              <Text
                style={[styles.subtitle, mono, { color: colors.textMuted }]}
              >
                {subtitle}
              </Text>
            </View>
          </View>

          {download.status === 'idle' || download.status === 'downloading' ? (
            <Notes notes={latest.notes} />
          ) : null}

          {download.status === 'downloading' ? (
            <>
              <Progress download={download} />
              <GradientButton
                label={translate('common.cancel')}
                onPress={() => dispatch(cancelUpdateDownload())}
                contentStyle={styles.actionContent}
              />
            </>
          ) : (
            <>
              {ready ? (
                <Alert variant="warning">
                  {translate('update.allowSource')}
                </Alert>
              ) : null}
              {download.status === 'failed' ? (
                <Alert>{translate('update.failed')}</Alert>
              ) : null}
              <View style={styles.actions}>
                <GradientButton
                  label={translate(
                    { ready: 'update.install', failed: 'update.tryAgain' }[
                      download.status
                    ] ?? 'update.update',
                  )}
                  onPress={install}
                  style={styles.actionFlex}
                  contentStyle={styles.actionContent}
                />
                <GradientButton
                  label={translate('update.later')}
                  onPress={later}
                  style={styles.actionFlex}
                  contentStyle={styles.actionContent}
                />
              </View>
            </>
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function Notes({ notes }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  if (!notes?.length) return null;
  return (
    <View style={styles.notes}>
      <Text style={[styles.label, plain, { color: colors.textFaint }]}>
        {translate('update.whatsNew')}
      </Text>
      {notes.map((note) => (
        <View key={note} style={styles.noteRow}>
          <Text style={[styles.note, { color: colors.textMuted }]}>•</Text>
          <Text
            style={[styles.note, styles.noteText, { color: colors.textMuted }]}
          >
            {note}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Progress({ download }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const mono = useMono();
  const fraction = download.total > 0 ? download.written / download.total : 0;
  return (
    <View style={styles.progress}>
      <View style={styles.progressLine}>
        <Text style={[styles.progressText, mono, { color: colors.textMuted }]}>
          {translate('update.downloading')}
        </Text>
        {download.total > 0 ? (
          <Text
            style={[
              styles.progressText,
              styles.mono,
              { color: colors.textMuted },
            ]}
          >
            {translate('update.progress', {
              written: mb(download.written),
              total: mb(download.total),
            })}
          </Text>
        ) : null}
      </View>
      <View style={[styles.bar, { backgroundColor: colors.cardBorderSoft }]}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: colors.accent, width: `${fraction * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12 },
  headText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12 },
  notes: { gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  noteRow: { flexDirection: 'row', gap: 6 },
  note: { fontSize: 13, lineHeight: 18 },
  noteText: { flex: 1 },
  progress: { gap: 8 },
  progressLine: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 12, fontWeight: '600' },
  mono: { fontFamily: 'monospace' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 12 },
  actionFlex: { flex: 1 },
  actionContent: { paddingVertical: 11 },
});
