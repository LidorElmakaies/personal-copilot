import { Ionicons } from '@expo/vector-icons';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import { longDate } from '../../../shared/i18n/format';
import { useTranslate } from '../../../shared/i18n/translate';
import { dayLabel } from '../utils/format';

// The add sheet's day (screen 2): a "Today" pill — "Yesterday", "Oct 25" once another is picked — that
// opens the `DayPicker`. `value`, `today` (YYYY-MM-DD), `onPress`.
export default function DateField({ value, today, onPress }) {
  const translate = useTranslate();
  return (
    <PillButton
      label={dayLabel(translate, value, today)}
      accessibilityLabel={longDate(translate, value)}
      icon={(color) => (
        <Ionicons name="calendar-outline" size={14} color={color} />
      )}
      tone={value === today ? 'muted' : 'accent'}
      onPress={onPress}
    />
  );
}
