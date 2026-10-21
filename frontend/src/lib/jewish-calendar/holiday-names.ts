import { gematriya } from '@hebcal/core';
import type { LocalizedName } from './models/shabbat-times';

const ROMAN: Record<string, number> = { II: 2, III: 3, IV: 4, V: 5, VI: 6 };
const FESTIVAL_HE: Record<string, string> = { Sukkot: 'סוכות', Pesach: 'פסח' };

/**
 * hebcal's holiday names, tidied where they read badly: the year on Rosh Hashana's first day,
 * and Chol HaMoed's "Sukkot III (CH''M)". `desc` is hebcal's untranslated description.
 */
export function holidayName(desc: string, name: LocalizedName): LocalizedName {
  if (/^Rosh Hashana \d+$/.test(desc)) {
    return { en: 'Rosh Hashana I', he: 'ראש השנה א׳' };
  }
  if (desc === 'Sukkot VII (Hoshana Raba)') {
    return { en: 'Hoshana Raba', he: 'הושענא רבה' };
  }
  const cholHaMoed = /^(Sukkot|Pesach) (II|III|IV|V|VI) \(CH''M\)$/.exec(desc);
  if (cholHaMoed) {
    const [, festival, roman] = cholHaMoed;
    const day = ROMAN[roman];
    return {
      en: `${festival} · day ${day} (Chol HaMoed)`,
      he: `${FESTIVAL_HE[festival]} · יום ${gematriya(day)} (חול המועד)`,
    };
  }
  return name;
}
