"use client"

import { api } from "@/lib/api"

// Asks the server to record the Join and release the meeting URL, then opens
// it. The URL is never part of the page, the bundle or any list response —
// the server hands it out only inside the join window (by its own clock).
//
// The new tab is reserved synchronously inside the click (so pop-up
// blockers allow it) and only pointed at the meeting once the server has
// answered. Returns { ok, appointment } or { ok: false, code, error }; on
// any refusal the reserved tab is closed again.
export async function joinMeeting(appointment) {
  const tab = typeof window !== "undefined" ? window.open("", "_blank") : null
  try {
    const { appointment: updated, meetingUrl } = await api.patch(`/appointments/${appointment._id}/join`)
    if (tab) {
      tab.opener = null
      tab.location.href = meetingUrl
    } else {
      window.open(meetingUrl, "_blank", "noopener,noreferrer")
    }
    return { ok: true, appointment: updated }
  } catch (err) {
    tab?.close()
    return { ok: false, code: err.code || "JOIN_FAILED", error: err }
  }
}

// Staff dashboard card: the meeting room link, fetched only when used.
export async function openMeetingRoom() {
  const tab = typeof window !== "undefined" ? window.open("", "_blank") : null
  try {
    const { meetingUrl } = await api.get("/appointments/meeting-room")
    if (!meetingUrl) throw new Error("No meeting link is configured.")
    if (tab) {
      tab.opener = null
      tab.location.href = meetingUrl
    }
    return { ok: true }
  } catch (err) {
    tab?.close()
    return { ok: false, error: err }
  }
}
