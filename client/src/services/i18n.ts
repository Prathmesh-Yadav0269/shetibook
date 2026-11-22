import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import mrTranslation from '../locales/mr/translation.json';
import enTranslation from '../locales/en/translation.json';

const savedLanguage = localStorage.getItem('shetibook_lang') || 'mr';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      mr: {
        translation: mrTranslation,
      },
      en: {
        translation: enTranslation,
      },
    },
    lng: savedLanguage,
    fallbackLng: 'mr',
    interpolation: {
      escapeValue: false,
    },
  });

export function changeLanguage(lang: 'mr' | 'en') {
  i18n.changeLanguage(lang);
  localStorage.setItem('shetibook_lang', lang);
}

export default i18n;
