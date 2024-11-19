import { TranslationKeys, SupportedLanguages } from './types';
import en from './en';
import tr from './tr';
export const translations: Record<SupportedLanguages, TranslationKeys> = {
  en,
  tr,
};

export const languageNames: Record<SupportedLanguages, string> = {
  en: 'English',
  tr: 'Türkçe',
}; 