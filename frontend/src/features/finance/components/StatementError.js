import { StyleSheet, View } from 'react-native';
import Alert from '../../../shared/components/base/feedback/Alert';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import { useTranslate } from '../../../shared/i18n/translate';
import { statementErrorText } from '../utils/statement';
import BoldText from './BoldText';

// Screen 5 when the statement `failed`: what went wrong, in plain words, and the way back to screen 4.
// `error` (the API's: `{ code, … }`), `source` (`file`/`text`), `onStartOver`, `onRetry` (read the kept
// statement again; its button only where that can help).
export default function StatementError({
  error,
  source = 'file',
  onStartOver,
  onRetry,
}) {
  const translate = useTranslate();
  const { title, parts, action, retry } = statementErrorText(
    translate,
    error,
    source,
  );
  return (
    <View style={styles.column}>
      <View accessibilityLiveRegion="polite">
        <Alert title={title}>
          <BoldText parts={parts} />
        </Alert>
      </View>
      {retry && (
        <GradientButton
          label={translate('statementError.retry')}
          onPress={onRetry}
          testID="statement-retry"
        />
      )}
      <GradientButton
        label={action}
        onPress={onStartOver}
        testID="statement-start-over"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 14 },
});
