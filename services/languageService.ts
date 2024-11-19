import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from './eventEmitter';
import { translations, languageNames } from '../translations';
import { SupportedLanguages } from '../translations/types';
import i18n from './i18n';

export const LanguageService = {
  i18n,
  
  async initialize() {
    const savedLanguage = await AsyncStorage.getItem('selectedLanguage');
    if (savedLanguage) {
      this.setLanguage(savedLanguage as SupportedLanguages);
    } else {
      const deviceLang = Localization.locale.split('-')[0] as SupportedLanguages;
      this.setLanguage(deviceLang in translations ? deviceLang : 'en');
    }
  },

  async setLanguage(languageCode: SupportedLanguages) {
    i18n.locale = languageCode;
    await AsyncStorage.setItem('selectedLanguage', languageCode);
    EventEmitter.emit('languageChanged', languageCode);
  },

  getLanguage(): SupportedLanguages {
    return i18n.locale as SupportedLanguages;
  },

  getSupportedLanguages() {
    return (Object.keys(translations) as SupportedLanguages[]).map(code => ({
      code,
      name: languageNames[code],
    }));
  },
}; 