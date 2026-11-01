import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import InputField from '../../../shared/components/base/form/InputField';
import SelectField from '../../../shared/components/base/form/SelectField';
import { useTranslate } from '../../../shared/i18n/translate';
import { onlyDigits, PHONE_COUNTRIES, phoneError } from '../utils/phone';
import {
  NAME_MAX_LENGTH,
  sanitizeName,
} from '../../../shared/utils/validation';

// Composite component (InputField/SelectField) — optional name/phone fields for register and
// ProfileCard. `value`: { firstName, lastName, country, phone (local digits — utils/phone.js) }.
export default function ProfileFields({ value, onChange, showErrors = false }) {
  const translate = useTranslate();
  const [phoneTouched, setPhoneTouched] = useState(false);
  const set = (field, clean) => (text) =>
    onChange({ ...value, [field]: clean ? clean(text) : text });
  const phoneProblem =
    showErrors || phoneTouched ? phoneError(value.country, value.phone) : null;
  const countryOptions = PHONE_COUNTRIES.map((c) => ({
    value: c.code,
    // The dial code kept left to right in a Hebrew line ("+972", not "972+").
    label: `${c.flag}  ${translate(`country.${c.code}`)} (\u2066${c.dialCode}\u2069)`,
    shortLabel: `${c.flag} ${c.dialCode}`,
  }));

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <InputField
          label={translate('profile.firstName')}
          value={value.firstName}
          onChangeText={set('firstName', sanitizeName)}
          autoCapitalize="words"
          maxLength={NAME_MAX_LENGTH}
          style={styles.flex}
        />
        <InputField
          label={translate('profile.lastName')}
          value={value.lastName}
          onChangeText={set('lastName', sanitizeName)}
          autoCapitalize="words"
          maxLength={NAME_MAX_LENGTH}
          style={styles.flex}
        />
      </View>
      {/* Wraps: on a narrow screen the phone field drops to its own full-width line. */}
      <View style={[styles.row, styles.wrap]}>
        <SelectField
          label={translate('profile.country')}
          value={value.country}
          options={countryOptions}
          onChange={set('country')}
          style={styles.country}
        />
        <InputField
          label={translate('profile.phone')}
          value={value.phone}
          onChangeText={set('phone', onlyDigits)}
          placeholder="0501234567"
          keyboardType="number-pad"
          maxLength={15}
          onBlur={() => setPhoneTouched(true)}
          error={phoneProblem && translate(phoneProblem)}
          style={styles.phone}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  wrap: { flexWrap: 'wrap' },
  flex: { flex: 1 },
  country: { width: 120 },
  phone: { flexGrow: 1, flexBasis: 140 },
});
