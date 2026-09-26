"use client"

import { useTranslation, LANGUAGES } from "@/lib/i18n"

// The NO / EN / SV / … switcher, shared by the public header (desktop and
// mobile menu) and the dashboard, so every page reads and sets the same
// language through the one I18nProvider.
const VARIANTS = {
  // Public header, desktop
  compact: {
    wrap: "flex items-center gap-[7px] text-[11px] font-[600] uppercase tracking-[0.07em]",
    item: "flex items-center gap-[7px]",
    divider: "text-white/35",
    button: "transition-colors duration-200 hover:text-white",
    active: "text-white",
    inactive: "text-white/60",
  },
  // Mobile menus
  menu: {
    wrap: "flex flex-wrap items-center gap-[10px] text-[13px] font-[700] uppercase tracking-[0.05em]",
    item: "flex items-center gap-[10px]",
    divider: "text-white/25",
    button: "",
    active: "text-white",
    inactive: "text-white/50",
  },
}

export default function LanguageSelector({ variant = "compact", className = "" }) {
  const { language, setLanguage } = useTranslation()
  const s = VARIANTS[variant] || VARIANTS.compact

  return (
    <div translate="no" className={`notranslate ${s.wrap} ${className}`}>
      {LANGUAGES.map((lng, i) => (
        <div key={lng.code} className={s.item}>
          {i > 0 && <span className={s.divider}>/</span>}
          <button
            type="button"
            lang={lng.code}
            title={lng.name}
            aria-label={lng.name}
            aria-pressed={language === lng.code}
            onClick={() => setLanguage(lng.code)}
            className={`${s.button} ${language === lng.code ? s.active : s.inactive}`}
          >
            {lng.label}
          </button>
        </div>
      ))}
    </div>
  )
}
