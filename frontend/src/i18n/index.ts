import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ur from "./ur.json";

export const RTL_LANGUAGES = ["ur", "ar"];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function applyLanguage(lang: string) {
  i18n.changeLanguage(lang);
  const isRtl = RTL_LANGUAGES.includes(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.classList.toggle("font-urdu", lang === "ur");
}

export default i18n;
