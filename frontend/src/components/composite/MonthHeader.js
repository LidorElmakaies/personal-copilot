import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

// The Calendar tab's title row: the Gregorian month, the Hebrew months under it (once loaded),
// a "Today" pill when `onToday` is given (the screen passes it only when away from today), and
// ‹ › arrows.
export default function MonthHeader({
  title,
  hebrewTitle,
  onPrevious,
  onNext,
  onToday,
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.head}>
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {hebrewTitle && (
          <Text style={[styles.hebrewTitle, { color: colors.accent }]}>
            {hebrewTitle}
          </Text>
        )}
      </View>
      <View style={styles.arrows}>
        {onToday && (
          <Pressable
            onPress={onToday}
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            style={({ pressed }) => [
              styles.today,
              {
                backgroundColor: colors.card,
                borderColor: colors.accent,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.todayText, { color: colors.accent }]}>
              Today
            </Text>
          </Pressable>
        )}
        <ArrowButton
          icon="chevron-back"
          label="Previous month"
          onPress={onPrevious}
        />
        <ArrowButton
          icon="chevron-forward"
          label="Next month"
          onPress={onNext}
        />
      </View>
    </View>
  );
}

function ArrowButton({ icon, label, onPress }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.arrow,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorderSoft,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titles: { flexShrink: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  hebrewTitle: { fontSize: 13, fontWeight: '600' },
  arrows: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  today: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
  },
  todayText: { fontSize: 12.5, fontWeight: '700' },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
