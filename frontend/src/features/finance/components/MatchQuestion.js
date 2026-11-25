import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { matchText } from '../utils/statement';
import BoldText from './BoldText';
import ChargeLine from './ChargeLine';

// "Is this yours?" (screen 6): a charge that several entries match, the likeliest first. "The other one"
// shows the next entry, and Yes is for the one shown. `line` (a statement line), `candidates` (entries),
// `onYes(entryId)`, `onNeither`.
export default function MatchQuestion({ line, candidates, onYes, onNeither }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [shown, setShown] = useState(0);

  return (
    <GlowCard>
      <View style={styles.card}>
        <ChargeLine line={line} />
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.question, { color: colors.text }]}
        >
          <BoldText parts={matchText(translate, candidates, shown)} />
        </Text>
        <View style={styles.answers}>
          <Answer
            color={colors.success}
            label={translate('common.yes')}
            onPress={() => onYes(candidates[shown].id)}
            testID="match-yes"
          />
          {candidates.length > 1 && (
            <Answer
              color={colors.accent}
              label={translate(
                candidates.length > 2 ? 'match.next' : 'match.other',
              )}
              onPress={() => setShown((shown + 1) % candidates.length)}
              testID="match-other"
            />
          )}
          <Answer
            color={colors.error}
            label={translate(
              ['common.no', 'match.neither'][candidates.length - 1] ??
                'match.none',
            )}
            onPress={onNeither}
            testID="match-neither"
          />
        </View>
      </View>
    </GlowCard>
  );
}

// Each answer its own color, all the same strength: none is nudged.
function Answer({ label, color, onPress, testID }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [
        styles.answer,
        {
          backgroundColor: `${color}1F`,
          borderColor: `${color}80`,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.answerText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  question: { fontSize: 13, lineHeight: 19 },
  answers: { flexDirection: 'row', gap: 6 },
  answer: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  answerText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
