import { reloadAppAsync } from 'expo';
import { I18nManager } from 'react-native';

// Android's right-to-left mirroring: saved by the phone, applied only when the app starts.
export const isRTL = () => I18nManager.isRTL;

export function setRTL(rtl) {
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

export const restart = () => reloadAppAsync('Language changed');
