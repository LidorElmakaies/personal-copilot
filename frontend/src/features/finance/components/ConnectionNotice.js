import Alert from '../../../shared/components/base/feedback/Alert';
import { count } from '../../../shared/i18n/format';
import { useTranslate } from '../../../shared/i18n/translate';

// Screen 1's note on the PC link: "Can't reach your PC — you can still add" while it's unreachable,
// else "2 entries waiting for your PC" while the outbox holds any; nothing otherwise.
// `reachable` (boolean), `waiting` (entries not sent yet).
export default function ConnectionNotice({ reachable, waiting = 0 }) {
  const translate = useTranslate();
  if (reachable && waiting === 0) return null;
  return (
    <Alert variant="warning">
      {reachable
        ? count(translate, 'count.waitingForPC', waiting)
        : translate('finance.unreachable')}
    </Alert>
  );
}
