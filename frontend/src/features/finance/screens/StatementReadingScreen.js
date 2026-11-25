import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import BackButton from '../../../shared/components/base/buttons/BackButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import StatementError from '../components/StatementError';
import StatementProgress from '../components/StatementProgress';
import { READING_STEPS, STATEMENT, STATEMENT_LINES } from '../mocks';

const toReview = () => router.replace('/finance-review');

// Screen 5 — opened by screen 4's Check: the steps tick, then the review takes this screen's place, so
// Back from it doesn't come here (Phase U: example timing, the real status is L6). `source`
// (`file`/`text`); `error` shows what went wrong instead: back to screen 4, or Try again reads
// it from the start.
export default function StatementReadingScreen({
  source = 'file',
  error: firstError = null,
  onDone = toReview,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [error, setError] = useState(firstError);
  const [at, setAt] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (error) return undefined;
    const timer = setTimeout(() => {
      if (at + 1 < READING_STEPS.length) setAt(at + 1);
      else done.current();
    }, READING_STEPS[at].ms);
    return () => clearTimeout(timer);
  }, [at, error]);

  const { status } = READING_STEPS[at];
  const read = status === 'matching' || status === 'needs_review';

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.title}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.titleText, { color: colors.text }]}>
            {translate('finance.monthlyCheck')}
          </Text>
        </View>
        {error ? (
          <StatementError
            error={error}
            source={source}
            onStartOver={() => router.back()}
            onRetry={() => setError(null)}
          />
        ) : (
          <StatementProgress
            status={status}
            source={source}
            lineCount={read ? STATEMENT_LINES.length : undefined}
            totalAgorot={read ? STATEMENT.declaredTotalAgorot : undefined}
          />
        )}
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, gap: 16 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { fontSize: 21, fontWeight: '600' },
});
