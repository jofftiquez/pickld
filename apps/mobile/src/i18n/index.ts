import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';

// Add a locale by dropping its JSON next to en.json and listing it here; no other code changes.
export const resources = { en: { translation: en } } as const;

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: getLocales()[0]?.languageCode ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
