// SPIKE (R1.1) — throwaway. Hidden route (personalcopilot://spike): runs the calendar lib on the
// device and compares with Gateway's answers. Delete with src/spike/.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../src/hooks/useAppTheme';

export default function Spike() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState({ results: null, error: null, totalMs: 0 });

  useEffect(() => {
    // Deferred a tick so the screen paints first; require() inside try so a module-load crash
    // (e.g. temporal-polyfill on Hermes) shows here instead of killing the app.
    const t = setTimeout(() => {
      const start = Date.now();
      try {
        const { runChecks, runtimeProbes } = require('../src/spike/runChecks');
        const expected = require('../src/spike/expected.json');
        const probes = runtimeProbes();
        const results = [...probes, ...runChecks(expected)];
        setState({ results, error: null, totalMs: Date.now() - start });
      } catch (e) {
        setState({
          results: null,
          error: `${e?.message}\n${e?.stack ?? ''}`,
          totalMs: Date.now() - start,
        });
      }
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const mono = { fontFamily: 'monospace', fontSize: 12, color: colors.text };
  const { results, error, totalMs } = state;
  const failed = results?.filter((r) => !r.pass).length ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16 }}
    >
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        R1.1 calendar spike
      </Text>
      <Text style={[mono, { color: colors.textMuted, marginBottom: 12 }]}>
        Hermes: {String(!!global.HermesInternal)} · total {totalMs} ms (incl. module load)
      </Text>
      {!results && !error && <Text style={mono}>Running…</Text>}
      {error && (
        <Text style={[mono, { color: colors.error }]} selectable>
          EXCEPTION: {error}
        </Text>
      )}
      {results && (
        <Text
          style={{
            color: failed ? colors.error : colors.success,
            fontWeight: '700',
            marginBottom: 8,
          }}
        >
          {failed ? `${failed} FAILED` : 'ALL PASS'} ({results.length} checks)
        </Text>
      )}
      {results?.map((r) => (
        <View key={r.name} style={{ marginBottom: 10 }}>
          <Text style={[mono, { color: r.pass ? colors.success : colors.error }]}>
            {r.pass ? 'PASS' : 'FAIL'} {r.name} ({r.ms.toFixed(1)} ms)
          </Text>
          <Text style={[mono, { color: colors.textMuted }]} selectable>
            {r.detail}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
