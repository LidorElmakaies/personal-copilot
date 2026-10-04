import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import InputField from '../base/form/InputField';
import SelectField from '../base/form/SelectField';
import { onlyDigits, PHONE_COUNTRIES, phoneError } from '../../utils/phone';
import { NAME_MAX_LENGTH, sanitizeName } from '../../utils/validation';

const COUNTRY_OPTIONS = PHONE_COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.flag}  ${c.name} (${c.dialCode})`,
  shortLabel: `${c.flag} ${c.dialCode}`,
}));

// Composite component (InputField/SelectField) — optional name/phone fields for register and
// ProfileCard. `value`: { firstName, lastName, country, phone (local digits — utils/phone.js) }.
export default function ProfileFields({ value, onChange, showErrors = false }) {
  const [phoneTouched, setPhoneTouched] = useState(false);
  const set = (field, clean) => (text) =>
    onChange({ ...value, [field]: clean ? clean(text) : text });
  const phoneFieldError =
    showErrors || phoneTouched ? phoneError(value.country, value.phone) : null;

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <InputField
          label="First name"
          value={value.firstName}
          onChangeText={set('firstName', sanitizeName)}
          autoCapitalize="words"
          maxLength={NAME_MAX_LENGTH}
          style={styles.flex}
        />
        <InputField
          label="Last name"
          value={value.lastName}
          onChangeText={set('lastName', sanitizeName)}
          autoCapitalize="words"
          maxLength={NAME_MAX_LENGTH}
          style={styles.flex}
        />
      </View>
      <View style={styles.row}>
        <SelectField
          label="Country"
          value={value.country}
          options={COUNTRY_OPTIONS}
          onChange={set('country')}
          style={styles.country}
        />
        <InputField
          label="Phone"
          value={value.phone}
          onChangeText={set('phone', onlyDigits)}
          placeholder="0501234567"
          keyboardType="number-pad"
          maxLength={15}
          onBlur={() => setPhoneTouched(true)}
          error={phoneFieldError}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  country: { width: 120 },
});
