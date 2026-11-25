import { useLocalSearchParams } from 'expo-router';
import { StatementReadingScreen } from '../src/features/finance';

export default function FinanceReading() {
  return <StatementReadingScreen source={useLocalSearchParams().source} />;
}
