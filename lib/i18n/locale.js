// The BCP-47 locale matching the selected UI language, for date/time
// formatting (month and weekday names, 24h vs 12h clock, ordering).
//
// A plain module rather than a hook because most formatters live in
// module-level helper functions outside any component. The I18nProvider
// updates it while rendering, before its children render, so every
// formatter call made during a render sees the current language.
const LOCALES = { no: "no-NO", en: "en-US", sv: "sv-SE", fi: "fi-FI", da: "da-DK" }

let active = LOCALES.no

export function setActiveLocale(language) {
  active = LOCALES[language] || LOCALES.no
}

export function getLocale() {
  return active
}
