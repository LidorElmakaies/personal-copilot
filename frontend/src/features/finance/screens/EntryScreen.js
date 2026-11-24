import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import BackButton from '../../../shared/components/base/buttons/BackButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import EntryDetails from '../components/EntryDetails';
import QuickAddSheet from '../components/QuickAddSheet';
import {
  CARDS,
  CATEGORIES,
  OCTOBER_ENTRIES,
  photosOf,
  pickExamplePhotos,
  TODAY,
} from '../mocks';
import { categoriesBySpending, categoryTotals } from '../utils/spending';

const ordered = categoriesBySpending(
  CATEGORIES,
  categoryTotals(OCTOBER_ENTRIES, CATEGORIES),
);
const nameOf = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));

// Screen 3, an entry opened from the list (Phase U: example data; Edit and the photos change it here
// only, and Delete just goes back — L3 saves and deletes). `id`, the entry's; unknown: only the back arrow. Android's back works
// too (the root Stack).
export default function EntryScreen({ id }) {
  const [entry, setEntry] = useState(() =>
    OCTOBER_ENTRIES.find((e) => e.id === id),
  );
  const [editing, setEditing] = useState(false);
  const [photos, setPhotos] = useState(entry ? photosOf(entry) : []);
  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        {entry ? (
          <EntryDetails
            entry={entry}
            categories={entry.categoryIds.map((c) => nameOf[c])}
            today={TODAY}
            statementMonth={Number(entry.occurredOn.slice(5, 7))}
            photos={photos}
            onChangePhotos={setPhotos}
            pickPhotos={pickExamplePhotos}
            onEdit={() => setEditing(true)}
            onDelete={() => router.back()}
            onBack={() => router.back()}
          />
        ) : (
          <BackButton onPress={() => router.back()} />
        )}
      </ScrollView>
      <QuickAddSheet
        visible={editing}
        onClose={() => setEditing(false)}
        categories={ordered}
        cards={CARDS}
        today={TODAY}
        pickPhotos={pickExamplePhotos}
        entry={entry}
        entryPhotos={photos}
        onSave={(fields, changedPhotos) => {
          setEntry({ ...entry, ...fields });
          setPhotos(changedPhotos);
        }}
      />
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, paddingBottom: 48 },
});
