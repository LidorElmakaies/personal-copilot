import { useLocalSearchParams } from 'expo-router';
import { EntryScreen } from '../src/features/finance';

export default function FinanceEntry() {
  return <EntryScreen id={useLocalSearchParams().id} />;
}
