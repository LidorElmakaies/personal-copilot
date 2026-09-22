import Chip from './Chip';

// Mirrors wsSlice's `status` values (connecting | connected | disconnected).
const STATUS_META = {
  connected: { label: 'Connected', variant: 'online' },
  connecting: { label: 'Connecting…', variant: 'pending' },
  disconnected: { label: 'Disconnected', variant: 'error' },
};

/**
 * Small reusable "are we live" indicator — a status Chip driven entirely by wsSlice's status.
 * Reads Redux state only; doesn't touch the connection itself (that's wsSlice's thunks).
 */
export default function ConnectionStatus({ status, style }) {
  const meta = STATUS_META[status] || STATUS_META.disconnected;
  return <Chip label={meta.label} variant={meta.variant} style={style} />;
}
