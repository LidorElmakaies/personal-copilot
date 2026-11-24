import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BackButton from '../../../shared/components/base/buttons/BackButton';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import ConfirmModal from '../../../shared/components/composite/ConfirmModal';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { dayLabel, formatShekels, paidWithLabel } from '../utils/format';
import PhotosField from './PhotosField';

// Screen 3, one entry: back, what it was for and Edit (off without `onEdit`); the amount ("+₪150" in
// green for money received, "not sent" beside it); a card with the day, the categories, how it was paid
// and its statement line (only a card entry's, or a matched one's); its photos; Delete, which asks first. `entry`, `categories`
// (its categories' names), `today` (YYYY-MM-DD), `statementMonth` (1–12, the matched line's), `photos`,
// `onChangePhotos`, `pickPhotos` (PhotosField's), `onEdit`, `onDelete`, `onBack`.
export default function EntryDetails({
  entry,
  categories,
  today,
  statementMonth,
  photos,
  onChangePhotos,
  pickPhotos,
  onEdit,
  onDelete,
  onBack,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [asking, setAsking] = useState(false);
  const received = entry.direction === 'income';
  const matched = entry.statementLine;

  return (
    <View style={styles.column}>
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={[styles.title, { color: colors.text }]}>
          {entry.description}
        </Text>
        <Pressable
          onPress={onEdit}
          disabled={!onEdit}
          accessibilityRole="button"
          testID="entry-edit"
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        >
          <Text style={[styles.editLabel, { color: colors.accent }]}>
            {translate('common.edit')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.amountRow}>
        <Text
          style={[
            styles.amount,
            { color: received ? colors.success : colors.text },
          ]}
        >
          {received && '+'}
          {formatShekels(entry.amountAgorot)}
        </Text>
        {entry.notSent && (
          <Badge color={colors.pending} bg={colors.pendingBg}>
            {translate('finance.notSent')}
          </Badge>
        )}
      </View>
      <GlowCard>
        <View style={styles.lines}>
          <Line label={translate('finance.date')}>
            <Value>{dayLabel(translate, entry.occurredOn, today)}</Value>
          </Line>
          {categories.length > 0 && (
            <Line
              label={translate(
                categories.length > 1
                  ? 'finance.categories'
                  : 'finance.category',
              )}
            >
              <Value>{categories.join('\n')}</Value>
            </Line>
          )}
          <Line
            label={translate(
              received ? 'finance.receivedWith' : 'finance.paidWithTitle',
            )}
          >
            <Value>{paidWithLabel(translate, entry)}</Value>
          </Line>
          {(matched || entry.paidWith === 'card') && (
            <Line label={translate('finance.statement')}>
              {matched ? (
                <Badge color={colors.success} bg={colors.successBg}>
                  {translate('finance.matchedLine', {
                    month: translate(`month.${statementMonth}`),
                    n: matched.lineNo,
                  })}
                </Badge>
              ) : (
                <Value muted>{translate('finance.notMatched')}</Value>
              )}
            </Line>
          )}
        </View>
      </GlowCard>
      <PhotosField
        large
        photos={photos}
        onChange={onChangePhotos}
        pickPhotos={pickPhotos}
      />
      <Pressable
        onPress={() => setAsking(true)}
        accessibilityRole="button"
        testID="entry-delete"
        style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
      >
        <Text style={[styles.editLabel, { color: colors.error }]}>
          {translate('finance.deleteEntry')}
        </Text>
      </Pressable>
      <ConfirmModal
        visible={asking}
        message={translate('finance.confirmDeleteEntry', {
          title: entry.description,
        })}
        onConfirm={() => {
          setAsking(false);
          onDelete();
        }}
        onCancel={() => setAsking(false)}
      />
    </View>
  );
}

function Line({ label, children }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.line}>
      <Text style={[styles.value, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.right}>{children}</View>
    </View>
  );
}

function Value({ muted, children }) {
  const { colors } = useAppTheme();
  return (
    <Text
      style={[styles.value, { color: muted ? colors.textMuted : colors.text }]}
    >
      {children}
    </Text>
  );
}

function Badge({ color, bg, children }) {
  return (
    <Text style={[styles.badge, { color, backgroundColor: bg }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  column: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 21, fontWeight: '600' },
  edit: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  editLabel: { fontSize: 14, textAlign: 'center' },
  pressed: { opacity: 0.6 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amount: { fontSize: 34, fontWeight: '600' },
  lines: { gap: 14 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  right: { flexShrink: 1, alignItems: 'flex-end' },
  value: { fontSize: 14 },
  badge: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  delete: { minHeight: 44, justifyContent: 'center' },
});
