import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import uk from './locales/uk.json';
import en from './locales/en.json';

export const LANGUAGES = [
    { code: 'uk', label: 'УКР' },
    { code: 'en', label: 'ENG' },
];
export const LANGUAGE_STORAGE_KEY = 'digitalbrush.lang';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: { uk: { translation: uk }, en: { translation: en } },
        supportedLngs: LANGUAGES.map(l => l.code),
        nonExplicitSupportedLngs: true, // uk-UA -> uk, en-US -> en
        fallbackLng: 'en',
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            lookupLocalStorage: LANGUAGE_STORAGE_KEY,
            caches: ['localStorage'],
        },
        interpolation: { escapeValue: false }, // React escapes already
        returnNull: false,
    });

const syncHtmlLang = (lng) => {
    if (typeof document !== 'undefined') document.documentElement.lang = (lng || 'uk').slice(0, 2);
};
syncHtmlLang(i18n.resolvedLanguage);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
