import { notifyRole, notifyUser } from "../notify.js"
import { sendEmail } from "../mailer.js"
import { User } from "../models/User.js"
import { DATE_LOCALES, pickLanguage, translator } from "../i18n/server.js"
import { formatOsloDateTime } from "./time.js"

// Best-effort messages when an appointment is cancelled or rescheduled.
// The customer always hears about it (in-app + email, in their saved
// language and time format); staff are told when the customer made the
// change. The in-app notification carries structured `data`, so the bell
// shows it in each viewer's own language. The appointment title is the
// customer's own text and is never translated. Never includes the meeting link.
export async function notifyAppointmentChange(appointment, { kind, byCustomer, previousStart = null }) {
  try {
    const data = {
      title: appointment.title,
      name: appointment.requestedByName,
      start: appointment.start,
      previousStart: kind === "rescheduled" ? previousStart : null,
    }
    const no = translator("no")
    const noWhen = formatOsloDateTime(appointment.start, "no-NO", "24h")
    const noBefore = previousStart ? formatOsloDateTime(previousStart, "no-NO", "24h") : ""
    const titleKey = kind === "cancelled" ? "notifications.titleAppointmentCancelled" : "notifications.titleAppointmentRescheduled"
    const msgKey = kind === "cancelled" ? "notifications.msgAppointmentCancelled" : "notifications.msgAppointmentRescheduled"
    // Stored Norwegian fallback text (older clients / the raw record).
    const fallback = { title: no(titleKey), message: no(msgKey, { title: appointment.title, when: noWhen, before: noBefore }) }

    if (appointment.requestedBy) {
      notifyUser(appointment.requestedBy, { type: `appointment_${kind}`, ...fallback, link: "/mine-bestillinger", data })
    }

    if (appointment.requestedByEmail) {
      const customer = appointment.requestedBy ? await User.findById(appointment.requestedBy).select("language timeFormat").lean() : null
      const lang = pickLanguage(customer?.language)
      const t = translator(lang)
      const fmt = customer?.timeFormat || "12h"
      const when = `${formatOsloDateTime(appointment.start, DATE_LOCALES[lang], fmt)} (${t("timeFormat.norwayTime")})`
      const before = previousStart ? formatOsloDateTime(previousStart, DATE_LOCALES[lang], fmt) : ""
      const vars = { name: appointment.requestedByName, title: appointment.title, when, before }
      const prefix = kind === "cancelled" ? "appointmentEmail.cancelled" : before ? "appointmentEmail.rescheduled" : "appointmentEmail.rescheduledNoBefore"
      sendEmail({
        to: appointment.requestedByEmail,
        subject: t(`${prefix}Subject`, vars),
        text: t(`${prefix}Body`, vars),
      })
    }

    if (byCustomer) {
      for (const [role, base] of [
        ["owner", "/dashboard/owner"],
        ["administrator", "/dashboard/admin"],
        ["moderator", "/dashboard/admin"],
      ]) {
        notifyRole(role, {
          type: `appointment_${kind}`,
          title: fallback.title,
          message: no("notifications.msgByCustomer", { name: appointment.requestedByName, message: fallback.message }),
          link: `${base}/ansattmoter`,
          data: { ...data, byCustomer: true },
        })
      }
    }
  } catch (err) {
    console.error("Appointment change notification failed:", err.message)
  }
}
