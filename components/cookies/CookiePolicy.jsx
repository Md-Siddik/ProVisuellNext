"use client"

import { useTranslation } from "@/lib/i18n"
import { useCookieConsent } from "@/context/CookieConsentContext"
import { COOKIE_CATEGORIES, CONSENT_MAX_AGE_DAYS, STORAGE_INVENTORY } from "@/lib/cookieConsent/config"
import { COOKIE_POLICY_UPDATED } from "@/lib/cookieConsent/policy"
import { formatOsloDate } from "@/lib/appointments/time"
import { getLocale } from "@/lib/i18n/locale"
import { primaryBtn } from "./ui"

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="mt-[34px]">
      <h2 id={id} className="text-[19px] font-[800] tracking-[-0.01em] text-white">
        {title}
      </h2>
      <div className="mt-[10px] space-y-[10px] text-[14.5px] leading-[1.7] text-white/70">{children}</div>
    </section>
  )
}

// The cookie policy. Every statement comes from the translations, the
// storage list from lib/cookieConsent/config.js (what the code really
// stores) and the contact details from the site's shared settings — the same
// values the footer shows and the Website Editor edits.
export default function CookiePolicy() {
  const { t } = useTranslation()
  const { consent, openSettings } = useCookieConsent()
  const email = t("footer.email").trim()
  const phone = t("footer.phone").trim()
  const categoryLabel = (key) => t(`cookies.category.${key}.title`)
  const current = consent
    ? COOKIE_CATEGORIES.map((c) => `${categoryLabel(c.key)}: ${c.required || consent[c.key] ? t("cookies.on") : t("cookies.off")}`).join(" · ")
    : t("cookies.policy.noChoiceYet")

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-[860px] px-[20px] pb-[70px] pt-[110px] sm:px-[40px]">
        <h1 className="text-[28px] font-[800] tracking-[-0.02em] sm:text-[34px]">{t("cookies.policy.title")}</h1>
        <p className="mt-[6px] text-[13px] text-white/45">{t("cookies.policy.updated", { date: formatOsloDate(new Date(`${COOKIE_POLICY_UPDATED}T12:00:00Z`), getLocale(), { dateStyle: "long" }) })}</p>
        <p className="mt-[16px] text-[15px] leading-[1.7] text-white/75">{t("cookies.policy.intro", { company: t("footer.companyName") })}</p>

        <div className="mt-[22px] rounded-[14px] border border-[#ff4b00]/30 bg-[#ff4b00]/[0.07] p-[16px]">
          <p className="text-[14px] font-[800] text-white">{t("cookies.policy.statusTitle")}</p>
          <p className="mt-[4px] text-[14px] leading-[1.65] text-white/75">{t("cookies.policy.statusText")}</p>
        </div>

        <Section id="what" title={t("cookies.policy.whatTitle")}>
          <p>{t("cookies.policy.whatText")}</p>
        </Section>

        <Section id="why" title={t("cookies.policy.whyTitle")}>
          <p>{t("cookies.policy.whyText")}</p>
        </Section>

        <Section id="categories" title={t("cookies.policy.categoriesTitle")}>
          {COOKIE_CATEGORIES.map((c) => (
            <div key={c.key} className="rounded-[12px] border border-white/10 bg-[#111212] p-[14px]">
              <h3 className="text-[15px] font-[800] text-white">
                {categoryLabel(c.key)}
                {c.required && <span className="ml-[8px] rounded-full bg-emerald-500/15 px-[8px] py-[2px] text-[11px] font-[800] text-emerald-300">{t("cookies.alwaysActive")}</span>}
              </h3>
              <p className="mt-[4px]">{t(`cookies.policy.category.${c.key}`)}</p>
              {!c.inUse && <p className="mt-[4px] font-[700] text-white/85">{t(`cookies.category.${c.key}.notInUse`)}</p>}
            </div>
          ))}
        </Section>

        <Section id="details" title={t("cookies.policy.detailsTitle")}>
          <p>{t("cookies.policy.detailsIntro")}</p>
          {/* Phones: one card per item. Wider screens: a table. */}
          <ul className="space-y-[8px] sm:hidden">
            {STORAGE_INVENTORY.map((item) => (
              <li key={item.name} className="rounded-[12px] border border-white/10 bg-[#111212] p-[12px] text-[13px]">
                <code className="break-all text-[12.5px] font-[700] text-white">{item.name}</code>
                <p className="mt-[4px] text-white/70">{t(`cookies.items.${item.purpose}`)}</p>
                <p className="mt-[6px] text-[12px] text-white/50">
                  {categoryLabel(item.category)} · {item.provider} · {t(`cookies.duration.${item.duration}`, { days: CONSENT_MAX_AGE_DAYS })} · {t(`cookies.storage.${item.storage}`)}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-[12px] border border-white/10 sm:block">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <caption className="sr-only">{t("cookies.policy.detailsTitle")}</caption>
              <thead className="bg-white/[0.04] text-white/55">
                <tr>
                  {["name", "purpose", "category", "provider", "duration"].map((c) => (
                    <th key={c} scope="col" className="px-[12px] py-[10px] font-[700]">
                      {t(`cookies.policy.column.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STORAGE_INVENTORY.map((item) => (
                  <tr key={item.name} className="border-t border-white/[0.06] align-top">
                    <td className="px-[12px] py-[10px]">
                      <code className="break-all text-[12px] font-[700] text-white">{item.name}</code>
                      <span className="mt-[2px] block text-[11.5px] text-white/40">{t(`cookies.storage.${item.storage}`)}</span>
                    </td>
                    <td className="px-[12px] py-[10px] text-white/70">{t(`cookies.items.${item.purpose}`)}</td>
                    <td className="px-[12px] py-[10px] text-white/70">{categoryLabel(item.category)}</td>
                    <td className="px-[12px] py-[10px] text-white/70">{item.provider}</td>
                    <td className="px-[12px] py-[10px] text-white/70">{t(`cookies.duration.${item.duration}`, { days: CONSENT_MAX_AGE_DAYS })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{t("cookies.policy.thirdParty")}</p>
        </Section>

        <Section id="change" title={t("cookies.policy.changeTitle")}>
          <p>{t("cookies.policy.changeText")}</p>
          <p className="text-[13px] text-white/50">
            {t("cookies.policy.currentChoice")}: {current}
          </p>
          <button type="button" onClick={openSettings} className={`${primaryBtn} mt-[4px]`}>
            {t("cookies.settingsLink")}
          </button>
        </Section>

        <Section id="duration" title={t("cookies.policy.durationTitle")}>
          <p>{t("cookies.policy.durationText", { days: CONSENT_MAX_AGE_DAYS })}</p>
        </Section>

        <Section id="contact" title={t("cookies.policy.contactTitle")}>
          <p>{t("cookies.policy.contactText")}</p>
          <address className="not-italic text-white/80">
            <span className="block font-[700] text-white">{t("footer.companyName")}</span>
            <span className="block">{t("footer.address")}</span>
            {email && (
              <a href={`mailto:${email}`} className="block text-[#ff9b6a] hover:underline">
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="block text-[#ff9b6a] hover:underline">
                {phone}
              </a>
            )}
          </address>
        </Section>
      </main>
    </div>
  )
}
