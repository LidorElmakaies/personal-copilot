import { useDispatch, useSelector } from 'react-redux';
import GlowCard from '../base/layout/GlowCard';
import Row from '../base/layout/Row';
import Switch from '../base/form/Switch';
import { useAppTheme } from '../../hooks/useAppTheme';
import { setThemeMode } from '../../store/slices/themeSlice';

// Composite component (GlowCard/Row/Switch) — the light/dark toggle.
export default function ThemeCard() {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.theme);
  const { isDark, colorMode } = useAppTheme();

  const toggleTheme = (nextIsDark) =>
    dispatch(setThemeMode(nextIsDark ? 'dark' : 'light'));

  return (
    <GlowCard>
      <Row
        title="Theme"
        subtitle={
          mode === null
            ? `Following system · ${colorMode}`
            : isDark
              ? 'Dark mode'
              : 'Light mode'
        }
        right={<Switch value={isDark} onValueChange={toggleTheme} />}
        last
      />
    </GlowCard>
  );
}
