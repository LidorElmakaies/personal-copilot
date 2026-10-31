import { ScrollView, StyleSheet, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import ThemeCard from '../../../shared/components/composite/ThemeCard';
import { changeLanguage } from '../../../shared/i18n/languageSlice';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import LanguageCard from '../components/LanguageCard';

// The Settings tab (canvas artboards 1–2): the language and the theme, kept on the phone.
export default function SettingsScreen() {
  const dispatch = useDispatch();
  const language = useSelector((state) => state.language.code);
  const { colors } = useAppTheme();

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.heading, { color: colors.text }]}>Settings</Text>
        <LanguageCard
          value={language}
          onChange={(code) => dispatch(changeLanguage(code))}
        />
        <ThemeCard />
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 64, gap: 16 },
  heading: { fontSize: 28, fontWeight: '600' },
});
