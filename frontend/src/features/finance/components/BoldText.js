import { StyleSheet, Text } from 'react-native';

// A sentence's pieces, some bold (`format.js`'s `boldParts`), for inside a `Text`.
export default function BoldText({ parts }) {
  return parts.map((part, i) =>
    part.bold ? (
      <Text key={i} style={styles.bold}>
        {part.text}
      </Text>
    ) : (
      part.text
    ),
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
});
