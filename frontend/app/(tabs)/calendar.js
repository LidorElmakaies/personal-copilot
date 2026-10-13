import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import GlowCard from '../../src/components/base/layout/GlowCard';
import AmbientBackground from '../../src/components/composite/AmbientBackground';
import MonthGrid from '../../src/components/composite/MonthGrid';
import MonthHeader from '../../src/components/composite/MonthHeader';
import MonthStatus from '../../src/components/composite/MonthStatus';
import { fetchMonth } from '../../src/store/slices/calendarSlice';
import { locate } from '../../src/store/slices/locationSlice';
import {
  hebrewTitle,
  localIsoDate,
  monthTitle,
  shiftMonth,
} from '../../src/utils/calendar';

// Times and holidays are for the device's location — the same one Home uses.
export default function CalendarScreen() {
  const dispatch = useDispatch();
  const location = useSelector((state) => state.location);
  const shownMonth = useSelector((state) => state.calendar.month);
  const [now] = useState(() => new Date());
  const [shown, setShown] = useState(() => ({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }));

  // Home finds the location on start; opened straight to this tab, nothing has asked yet.
  useEffect(() => {
    if (location.status === 'idle') dispatch(locate());
  }, [location.status, dispatch]);

  useEffect(() => {
    if (location.coords) dispatch(fetchMonth(shown));
  }, [shown, location.coords, dispatch]);

  const days =
    shownMonth.year === shown.year && shownMonth.month === shown.month
      ? shownMonth.days
      : null;

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <GlowCard style={styles.panel}>
          <MonthHeader
            title={monthTitle(shown)}
            hebrewTitle={days ? hebrewTitle(days) : null}
            onPrevious={() => setShown((m) => shiftMonth(m, -1))}
            onNext={() => setShown((m) => shiftMonth(m, 1))}
          />
          {days ? (
            <MonthGrid days={days} today={localIsoDate(now)} />
          ) : (
            <MonthStatus
              locationStatus={location.status}
              hasLocation={!!location.coords}
              loadFailed={shownMonth.status === 'failed'}
              onRetry={() =>
                location.coords
                  ? dispatch(fetchMonth(shown))
                  : dispatch(locate())
              }
            />
          )}
        </GlowCard>
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: { width: '100%', maxWidth: 420 },
});
