import { useTranslate } from '../../../shared/i18n/translate';
import { PAID_WITH } from '../utils/filter';
import { paidWithName } from '../utils/format';
import SegmentRow from './SegmentRow';

// The add sheet's "Paid with" (screen 2): Card, Bit, PayBox, Cash, Transfer in one row, one chosen.
// `value` (one of PAID_WITH), `onChange(value)`; `options` limits them.
export default function PaidWithPicker({
  value,
  onChange,
  options = PAID_WITH,
}) {
  const translate = useTranslate();
  return (
    <SegmentRow
      options={options.map((p) => ({
        value: p,
        label: paidWithName(translate, p),
      }))}
      value={value}
      onChange={onChange}
      testID="paid-with"
    />
  );
}
