import { Image, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import GradientButton from '../base/buttons/GradientButton';
import Alert from '../base/feedback/Alert';
import BottomSheet from '../base/layout/BottomSheet';
import { VERSION } from '../../config/version';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  cancelUpdateDownload,
  dismissUpdate,
  installUpdate,
} from '../../store/slices/appUpdateSlice';

const ICON = require('../../../assets/images/icon.png');

const mb = (bytes) => Math.round(bytes / 1e6);

// Composite component (BottomSheet/GradientButton/Alert) — the APK's "new version" sheet (mockups
// U2, U2a–c). Opens by itself once per version (appUpdateSlice); UpdateChip on Home reopens it.
// Later, a drag down or a tap outside close it — a running download carries on.
export default function UpdateSheet() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { latest, sheetOpen, download } = useSelector(
    (state) => state.appUpdate,
  );
  const later = () => dispatch(dismissUpdate());
  const install = () => dispatch(installUpdate());

  let subtitle = `You have ${VERSION.frontend}`;
  if (download.status === 'ready' && download.total > 0)
    subtitle = `Downloaded · ${mb(download.total)} MB`;

  return (
    <BottomSheet visible={sheetOpen && !!latest} onClose={later}>
      {latest ? (
        <View style={styles.body}>
          <View style={styles.head}>
            <Image source={ICON} style={styles.icon} />
            <View style={styles.headText}>
              <Text style={[styles.title, { color: colors.text }]}>
                Version {latest.version} is{' '}
                {download.status === 'ready' ? 'ready' : 'available'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
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
                label="Cancel"
                onPress={() => dispatch(cancelUpdateDownload())}
                contentStyle={styles.actionContent}
              />
            </>
          ) : (
            <>
              {download.status === 'ready' ? (
                <Alert variant="warning">
                  If Android asks, turn on "Allow from this source" for Personal
                  Copilot, then come back and tap Install.
                </Alert>
              ) : null}
              {download.status === 'failed' ? (
                <Alert>
                  The download stopped. Check the connection and try again.
                </Alert>
              ) : null}
              <View style={styles.actions}>
                <GradientButton
                  label={
                    { ready: 'Install', failed: 'Try again' }[
                      download.status
                    ] ?? 'Update'
                  }
                  onPress={install}
                  style={styles.actionFlex}
                  contentStyle={styles.actionContent}
                />
                <GradientButton
                  label="Later"
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
  if (!notes?.length) return null;
  return (
    <View style={styles.notes}>
      <Text style={[styles.label, { color: colors.textFaint }]}>
        What's new
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
  const fraction = download.total > 0 ? download.written / download.total : 0;
  return (
    <View style={styles.progress}>
      <View style={styles.progressLine}>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          Downloading…
        </Text>
        {download.total > 0 ? (
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {mb(download.written)} / {mb(download.total)} MB
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
  subtitle: { fontSize: 12, fontFamily: 'monospace' },
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
  progressText: { fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 12 },
  actionFlex: { flex: 1 },
  actionContent: { paddingVertical: 11 },
});
