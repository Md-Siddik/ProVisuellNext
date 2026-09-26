"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { getLocale } from "@/lib/i18n/locale"
import { useTranslation } from "@/lib/i18n"
import { getPreference, setPreference } from "@/lib/cookieConsent/preferenceStorage"
import {
  DEFAULT_TIME_FORMAT,
  formatAppointmentTime,
  formatOsloDate,
  formatOsloDateTime,
  formatOsloTime,
  isTimeFormat,
} from "@/lib/appointments/time"

// The visitor's 12-hour / 24-hour preference for appointment times.
// Presentation only: switching never refetches or changes any time value.
//
// Persistence: localStorage for everyone (instant, works for guests), plus
// the User document for signed-in accounts so it follows them across
// devices. On sign-in a saved account preference wins; if the account has
// none yet, the one chosen on this device is saved to it.

export const TIME_FORMAT_STORAGE_KEY = "provisuell_time_format"

function readStored() {
  try {
    const v = getPreference(TIME_FORMAT_STORAGE_KEY)
    return isTimeFormat(v) ? v : null
  } catch {
    return null
  }
}

function writeStored(value) {
  // A "preferences" item: remembered across visits only with cookie consent.
  setPreference(TIME_FORMAT_STORAGE_KEY, value)
}

const TimeFormatContext = createContext(null)

export function TimeFormatProvider({ children }) {
  // Server HTML always renders the default; the stored choice is applied
  // once hydrated, like the language preference in lib/i18n.
  const [timeFormat, setTimeFormatState] = useState(DEFAULT_TIME_FORMAT)
  const { profile } = useAuth()
  const syncedFor = useRef(null)
  const { language, hydrated } = useTranslation()
  const languageSent = useRef(null)

  // Keep the account's language in step with the one picked on the site, so
  // emails (invoices, meeting changes) reach the customer in that language.
  useEffect(() => {
    if (!hydrated || !profile?._id) return
    const key = `${profile._id}:${language}`
    if (languageSent.current === key) return
    languageSent.current = key
    if (profile.language === language) return
    api.patch("/auth/preferences", { language }).catch(() => {
      languageSent.current = null
    })
  }, [hydrated, profile, language])

  useEffect(() => {
    const stored = readStored()
    if (stored) setTimeFormatState(stored)
  }, [])

  // Reconcile with the signed-in account once per account.
  useEffect(() => {
    if (!profile?._id || syncedFor.current === profile._id) return
    syncedFor.current = profile._id
    if (isTimeFormat(profile.timeFormat)) {
      setTimeFormatState(profile.timeFormat)
      writeStored(profile.timeFormat)
    } else {
      const local = readStored()
      if (local) api.patch("/auth/preferences", { timeFormat: local }).catch(() => {})
    }
  }, [profile])

  const setTimeFormat = useCallback(
    (value) => {
      if (!isTimeFormat(value)) return
      setTimeFormatState(value)
      writeStored(value)
      if (profile?._id) {
        api.patch("/auth/preferences", { timeFormat: value }).catch((err) => {
          console.error("Failed to save time format:", err.message)
        })
      }
    },
    [profile?._id]
  )

  const value = useMemo(
    () => ({
      timeFormat,
      setTimeFormat,
      // "15:30" → "03:30 PM" / "15:30"
      formatTime: (time) => formatAppointmentTime(time, timeFormat),
      // Instants (ISO / Date) — always shown in Norway time.
      formatInstantTime: (value) => formatOsloTime(value, timeFormat),
      formatInstantDate: (value, options) => formatOsloDate(value, getLocale(), options),
      formatInstantDateTime: (value, dateOptions) => formatOsloDateTime(value, getLocale(), timeFormat, dateOptions),
    }),
    [timeFormat, setTimeFormat]
  )

  return <TimeFormatContext.Provider value={value}>{children}</TimeFormatContext.Provider>
}

export function useTimeFormat() {
  const ctx = useContext(TimeFormatContext)
  if (!ctx) throw new Error("useTimeFormat must be used within TimeFormatProvider")
  return ctx
}
