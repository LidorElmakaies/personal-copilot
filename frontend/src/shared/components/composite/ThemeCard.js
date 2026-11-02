import { useDispatch, useSelector } from 'react-redux';
import GlowCard from '../base/layout/GlowCard';
import Row from '../base/layout/Row';
import Switch from '../base/form/Switch';
import { useTranslate } from '../../i18n/translate';
import { useAppTheme } from '../../theme/useAppTheme';
import { setThemeMode } from '../../theme/themeSlice';

// Composite component (GlowCard/Row/Switch) — the light/dark toggle.
export default function ThemeCard() {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.theme);
  const { isDark } = useAppTheme();
  const translate = useTranslate();

  const toggleTheme = (nextIsDark) =>
    dispatch(setThemeMode(nextIsDark ? 'dark' : 'light'));

  return (
    <GlowCard>
      <Row
        title={translate('theme.title')}
        subtitle={translate(
          mode === null
            ? isDark
              ? 'theme.systemDark'
              : 'theme.systemLight'
            : isDark
              ? 'theme.dark'
              : 'theme.light',
        )}
        right={<Switch value={isDark} onValueChange={toggleTheme} />}
        last
      />
    </GlowCard>
  );
}
