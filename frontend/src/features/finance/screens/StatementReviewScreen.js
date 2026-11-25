import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import BackButton from '../../../shared/components/base/buttons/BackButton';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { count } from '../../../shared/i18n/format';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import MatchQuestion from '../components/MatchQuestion';
import QuickAddSheet from '../components/QuickAddSheet';
import UnreportedRow from '../components/UnreportedRow';
import {
  CARDS,
  CATEGORIES,
  FINANCE_SETTINGS,
  OCTOBER_ENTRIES,
  pickExamplePhotos,
  STATEMENT,
  STATEMENT_LINES,
  TODAY,
} from '../mocks';
import { categoriesBySpending, categoryTotals } from '../utils/spending';
import {
  answerLine,
  confirmLine,
  rejectLine,
  statementSummary,
} from '../utils/statement';

const layout = LinearTransition.duration(220);
const fadeIn = FadeIn.duration(220);
const fadeOut = FadeOut.duration(150);
const ordered = categoriesBySpending(
  CATEGORIES,
  categoryTotals(OCTOBER_ENTRIES, CATEGORIES),
);
const entryOf = new Map(OCTOBER_ENTRIES.map((e) => [e.id, e]));
const { issuer } = FINANCE_SETTINGS.cards.find(
  (c) => c.cardLast4 === STATEMENT.cardLast4,
);

// Screen 6, the statement's review — opened from `ReviewBanner`, and by screen 5 when it's read: the
// charges to confirm, then those not reported (Phase U: example lines, answered here only). A row opens its
// answer (screen 7), then the rest of the list one after another, from it and around; closing stops. Yes counts the charge as reported; Neither moves it to the list. `initialLines` for the stories.
export default function StatementReviewScreen({
  initialLines = STATEMENT_LINES,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const [lines, setLines] = useState(initialLines);
  const { month, reported } = statementSummary(lines);
  const questions = lines.filter((l) => l.matchStatus === 'suggested');
  const unreported = lines.filter((l) => l.matchStatus === 'unmatched');

  // The charges being answered (their lines) and which one it's at; null: the sheet is closed.
  const [answering, setAnswering] = useState(null);
  const open = (i) =>
    setAnswering({
      queue: [...unreported.slice(i), ...unreported.slice(0, i)],
      at: 0,
    });
  const next = () =>
    setAnswering(({ queue, at }) =>
      at + 1 < queue.length ? { queue, at: at + 1 } : null,
    );
  const charge = answering && {
    line: answering.queue[answering.at],
    cardLast4: STATEMENT.cardLast4,
    n: answering.at + 1,
    total: answering.queue.length,
  };

  const heading = (key, n) => (
    <Animated.Text
      layout={layout}
      exiting={fadeOut}
      style={[styles.heading, plain, { color: colors.textMuted }]}
    >
      {translate(key, { n })}
    </Animated.Text>
  );

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.titles}>
            <Text style={[styles.title, { color: colors.text }]}>
              {translate('review.title', {
                month: translate(`month.${month.month}`),
                card: translate('finance.issuerCard', {
                  issuer,
                  last4: STATEMENT.cardLast4,
                }),
              })}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.summary, { color: colors.textMuted }]}
            >
              {translate('review.summary', {
                lines: count(translate, 'count.lines', lines.length),
                reported: count(translate, 'count.alreadyReported', reported),
              })}
            </Text>
          </View>
        </View>
        {questions.length > 0 && heading('review.questions', questions.length)}
        {questions.map((line) => {
          const { candidateEntryIds } = line.suggestion;
          return (
            <Animated.View
              // Starts over from the likeliest if its candidates change.
              key={`${line.id}-${candidateEntryIds.length}`}
              layout={layout}
              exiting={fadeOut}
            >
              <MatchQuestion
                line={line}
                candidates={candidateEntryIds.map((id) => entryOf.get(id))}
                onYes={(entryId) =>
                  setLines(confirmLine(lines, line.id, entryId))
                }
                onNeither={() => setLines(rejectLine(lines, line.id))}
              />
            </Animated.View>
          );
        })}
        {unreported.length > 0 &&
          heading('review.unreported', unreported.length)}
        {unreported.length > 0 && (
          <Animated.View layout={layout} entering={fadeIn}>
            <GlowCard>
              {unreported.map((line, i) => (
                <Animated.View
                  key={line.id}
                  layout={layout}
                  entering={fadeIn}
                  exiting={fadeOut}
                >
                  {i > 0 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.cardBorderSoft },
                      ]}
                    />
                  )}
                  <UnreportedRow line={line} onPress={() => open(i)} />
                </Animated.View>
              ))}
            </GlowCard>
          </Animated.View>
        )}
      </ScrollView>
      <QuickAddSheet
        visible={!!charge}
        onClose={() => setAnswering(null)}
        charge={charge}
        categories={ordered}
        cards={CARDS}
        today={TODAY}
        pickPhotos={pickExamplePhotos}
        onSkip={next}
        onSave={() => {
          setLines(answerLine(lines, charge.line.id));
          next();
        }}
      />
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, paddingBottom: 36, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 20, fontWeight: '600' },
  summary: { fontSize: 12 },
  heading: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  divider: { height: StyleSheet.hairlineWidth },
});
