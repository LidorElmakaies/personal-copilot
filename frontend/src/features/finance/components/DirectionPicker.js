import { useTranslate } from '../../../shared/i18n/translate';
import SegmentRow from './SegmentRow';

// The add sheet's "I spent" / "I received". `value` ('expense' | 'income'), `onChange(value)`.
export default function DirectionPicker({ value, onChange }) {
  const translate = useTranslate();
  return (
    <SegmentRow
      options={['expense', 'income'].map((d) => ({
        value: d,
        label: translate(`direction.${d}`),
      }))}
      value={value}
      onChange={onChange}
      testID="direction"
    />
  );
}
