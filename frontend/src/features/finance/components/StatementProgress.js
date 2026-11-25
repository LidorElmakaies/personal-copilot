import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { count } from '../../../shared/i18n/format';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { formatShekels } from '../utils/format';
import { statementSteps } from '../utils/statement';

// Screen 5 while the statement is read: a spinner and the steps, ticking one by one. `status` (the
// API's: `received`, `parsing`, `matching`, `needs_review`), `source` (`file`/`text`), `lineCount` and
// `totalAgorot` (known once the lines are read).
export default function StatementProgress({
  status,
  source = 'file',
  lineCount,
  totalAgorot,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const steps = statementSteps(status);
  const linesRead = steps[1].state === 'done' && lineCount != null;
  const labels = {
    received: translate(
      source === 'text' ? 'statement.textReceived' : 'statement.fileReceived',
    ),
    parsing: linesRead
      ? translate('statement.linesRead', {
          lines: count(translate, 'count.linesRead', lineCount),
          total: formatShekels(totalAgorot),
        })
      : translate('statement.readingLines'),
    matching: translate('statement.matching'),
  };
  const dotColor = {
    done: colors.success,
    active: colors.accent,
    waiting: colors.cardBorder,
  };

  return (
    <GlowCard>
      <View style={styles.card}>
        <ActivityIndicator size={44} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>
          {translate('statement.reading')}
        </Text>
        {steps.map(({ step, state }) => {
          const done = state === 'done';
          const label = labels[step];
          return (
            <View
              key={step}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={
                done ? translate('statement.stepDone', { step: label }) : label
              }
              accessibilityState={{ busy: state === 'active' }}
              style={styles.step}
              testID={`step-${step}-${state}`}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? colors.success : 'transparent',
                    borderColor: dotColor[state],
                  },
                ]}
              >
                {done && (
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={colors.onPrimary}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stepText,
                  {
                    color: state === 'waiting' ? colors.textMuted : colors.text,
                  },
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
        <Text style={[styles.leave, { color: colors.textMuted }]}>
          {translate('statement.canLeave')}
        </Text>
      </View>
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  title: { fontSize: 16, textAlign: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, fontSize: 14 },
  leave: { fontSize: 12, textAlign: 'center' },
});
