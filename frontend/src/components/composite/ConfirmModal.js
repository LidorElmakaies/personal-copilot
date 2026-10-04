import { Modal, StyleSheet, Text, View } from 'react-native';
import GlowCard from '../base/layout/GlowCard';
import GradientButton from '../base/buttons/GradientButton';
import { useAppTheme } from '../../hooks/useAppTheme';

// Reusable Yes/No confirm overlay — in-house replacement for Alert.alert so a prompt matches this
// app's themed look instead of the platform-native alert box. `icon` and `title` are optional.
export default function ConfirmModal({
  visible,
  icon,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
}) {
  const { colors } = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <GlowCard solid style={styles.card}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          {title ? (
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          ) : null}
          <Text
            style={[
              styles.message,
              { color: title ? colors.textMuted : colors.text },
              title && styles.messageUnderTitle,
            ]}
          >
            {message}
          </Text>
          <View style={styles.actions}>
            <GradientButton
              label={confirmLabel}
              onPress={onConfirm}
              style={styles.buttonFlex}
              contentStyle={styles.buttonContent}
            />
            <GradientButton
              label={cancelLabel}
              onPress={onCancel}
              style={styles.buttonFlex}
              contentStyle={styles.buttonContent}
            />
          </View>
        </GlowCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 360 },
  icon: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  message: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 18,
  },
  messageUnderTitle: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12 },
  buttonFlex: { flex: 1 },
  buttonContent: { paddingVertical: 10 },
});
