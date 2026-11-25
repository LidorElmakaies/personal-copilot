import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BackButton from '../../../shared/components/base/buttons/BackButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import CardChips from '../components/CardChips';
import StatementSource from '../components/StatementSource';
import { EXAMPLE_STATEMENT_FILE, STATEMENT_CARDS } from '../mocks';

// Screen 4, the monthly check — opened from the header's pill: which card, then its statement (Phase U:
// Choose file… picks an example one, the real picker is L6; Check opens
// screen 5's reading). Android's back works too (the root Stack).
export default function StatementCheckScreen() {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [card, setCard] = useState(STATEMENT_CARDS[0]?.last4 ?? null);
  const [file, setFile] = useState(null);
  const issuer = STATEMENT_CARDS.find((c) => c.last4 === card)?.issuer;
  return (
    <AmbientBackground>
      <View style={styles.container}>
        <StatementSource
          header={
            <>
              <View style={styles.title}>
                <BackButton onPress={() => router.back()} />
                <Text style={[styles.titleText, { color: colors.text }]}>
                  {translate('finance.monthlyCheck')}
                </Text>
              </View>
              <CardChips
                cards={STATEMENT_CARDS}
                value={card}
                onChange={setCard}
              />
            </>
          }
          card={card}
          issuer={issuer}
          file={file}
          onChooseFile={() => setFile(EXAMPLE_STATEMENT_FILE)}
          onCheck={({ source }) =>
            router.push({ pathname: '/finance-reading', params: { source } })
          }
        />
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 64, paddingBottom: 36 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { fontSize: 21, fontWeight: '600' },
});
