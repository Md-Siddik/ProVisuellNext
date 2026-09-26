// Meeting attendance, shared by the API and the UI.
//   scheduled — the meeting hasn't ended and nobody has joined yet
//   joined    — the attendee pressed Join (joinedAt is set)
//   missed    — the meeting ended without a Join
// This reflects the Join button, not verified presence in Google Meet.

// Customers can join from the start time; staff hosts 15 minutes early.
export const STAFF_JOIN_EARLY_MINUTES = 15
export const CUSTOMER_RESCHEDULE_CUTOFF_MINUTES = 60

export function attendanceStatus(appt, now = new Date()) {
  if (appt?.joinedAt) return "joined"
  const end = new Date(appt?.end)
  if (!Number.isNaN(end.getTime()) && end <= now) return "missed"
  return "scheduled"
}

export function joinWindow(appt, now = new Date(), earlyMinutes = 0) {
  const start = new Date(appt.start).getTime()
  const end = new Date(appt.end).getTime()
  const t = now.getTime()
  if (t < start - earlyMinutes * 60000) return "too_early"
  if (t >= end) return "ended"
  return "open"
}

// Customer self-service rules (the server enforces these with its own clock).
export function customerCanReschedule(appt, now = new Date()) {
  return appt.status === "scheduled" && !appt.joinedAt && new Date(appt.start).getTime() - now.getTime() >= CUSTOMER_RESCHEDULE_CUTOFF_MINUTES * 60000
}

export function customerCanCancel(appt, now = new Date()) {
  return appt.status === "scheduled" && now < new Date(appt.start)
}

// Plain object with the derived status filled in, for API responses.
export function withAttendance(appt, now = new Date()) {
  const plain = typeof appt?.toObject === "function" ? appt.toObject() : { ...appt }
  return { ...plain, attendanceStatus: attendanceStatus(plain, now) }
}
