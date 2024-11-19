import { I18n } from 'i18n-js';
import { translations } from './index';

const i18n = new I18n(translations);

// Fallback to english if a translation is missing
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n; 