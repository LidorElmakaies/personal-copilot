import { Pressable, StyleSheet, Text, View } from 'react-native';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// Each in its own language, in the same order whichever is picked.
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'he', label: 'עברית' },
];

// The Settings tab's language picker (canvas artboards 1–2): `value` is 'en' | 'he', a tap calls
// `onChange(code)`. Presentational; the screen owns Redux.
export default function LanguageCard({ value, onChange }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.box}>
      <GlowCard>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          Language
        </Text>
        {LANGUAGES.map(({ code, label }, i) => {
          const on = code === value;
          return (
            <View key={code}>
              {/* A hairline View, not a borderTop — see frontend.md's "Bug patterns". */}
              {i > 0 && (
                <View
                  style={[
                    styles.rule,
                    { backgroundColor: colors.cardBorderSoft },
                  ]}
                />
              )}
              <Pressable
                onPress={() => !on && onChange(code)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [
                  styles.option,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.name, { color: colors.text }]}>
                  {label}
                </Text>
                {/* Border and dot always drawn, only their colors change — see "Bug patterns". */}
                <View
                  style={[
                    styles.radio,
                    { borderColor: on ? colors.accent : colors.inactiveTab },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: on ? colors.accent : 'transparent' },
                    ]}
                  />
                </View>
              </Pressable>
            </View>
          );
        })}
      </GlowCard>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Changing the language restarts the app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6 },
  label: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 4,
  },
  rule: { height: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  name: { flex: 1, fontSize: 15 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  note: { fontSize: 12, paddingHorizontal: 4 },
});
