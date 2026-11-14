import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { count } from '../../../shared/i18n/format';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { formatShekels } from '../utils/format';
import { totalAgorot } from '../utils/spending';
import CategoryBar from './CategoryBar';

const TOP = 3;
const layout = LinearTransition.duration(220);
const fadeIn = FadeIn.duration(220);
const fadeOut = FadeOut.duration(150);

// "Spent this month" (screen 1): the month's total, its top 3 categories, "+ N more categories"
// opening the rest (and "Show less"). `totals` from `categoryTotals` — biggest first.
export default function SpentCard({ totals }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const [open, setOpen] = useState(false);
  const more = totals.length - TOP;
  const shown = open ? totals : totals.slice(0, TOP);
  const biggest = totals[0]?.amountAgorot ?? 0;

  return (
    <GlowCard>
      <Animated.View layout={layout} style={styles.body}>
        <Text style={[styles.label, plain, { color: colors.textMuted }]}>
          {translate('finance.spentThisMonth')}
        </Text>
        <Text style={[styles.total, { color: colors.text }]}>
          {formatShekels(totalAgorot(totals))}
        </Text>
        {shown.map((t, i) => (
          <Animated.View
            key={t.id}
            layout={layout}
            entering={i >= TOP ? fadeIn : undefined}
            exiting={fadeOut}
          >
            <CategoryBar
              name={t.name}
              amountAgorot={t.amountAgorot}
              biggestAgorot={biggest}
            />
          </Animated.View>
        ))}
        {more > 0 && (
          <Animated.View layout={layout} style={styles.toggleRow}>
            <Pressable
              onPress={() => setOpen(!open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.toggle,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.toggleText, { color: colors.accent }]}>
                {open
                  ? translate('finance.showLess')
                  : count(translate, 'count.moreCategories', more)}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: 10 },
  label: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  total: { fontSize: 34, fontWeight: '600', marginTop: -4 },
  toggleRow: { flexDirection: 'row' },
  toggle: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  toggleText: { fontSize: 13 },
});
