import { useDispatch, useSelector } from 'react-redux';
import { setSampleReminders } from '../../store/slices/calendarSlice';
import Switch from '../base/form/Switch';
import GlowCard from '../base/layout/GlowCard';
import Row from '../base/layout/Row';

// Composite component (GlowCard/Row/Switch) — the Admin tab's switch that fills the Calendar tab
// with made-up per-day reminders (120 on the 24th, 500 on the 10th, a few on other days), so the
// busy-day display can be seen before real per-day reminders exist. Memory only; remove it when
// they arrive.
export default function SampleRemindersCard() {
  const dispatch = useDispatch();
  const on = useSelector((state) => state.calendar.sampleReminders);

  const toggle = (next) => {
    const now = new Date();
    dispatch(
      setSampleReminders({
        on: next,
        around: { year: now.getFullYear(), month: now.getMonth() + 1 },
      }),
    );
  };

  return (
    <GlowCard>
      <Row
        title="Sample reminders on the calendar"
        subtitle={
          on
            ? 'On · 120 on the 24th of each month, 500 on the 10th, a few on other days'
            : 'Off · fills the Calendar tab with made-up reminders, for testing'
        }
        right={
          <Switch
            value={on}
            onValueChange={toggle}
            accessibilityLabel="Sample reminders on the calendar"
          />
        }
        last
      />
    </GlowCard>
  );
}
