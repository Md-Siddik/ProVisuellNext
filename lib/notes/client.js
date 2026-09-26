"use client"

import { api } from "@/lib/api"
import { auth } from "@/lib/firebaseClient"
import { addDays, getNorwayNow, weekdayIndex } from "@/lib/appointments/time"

// Browser-side helpers for the Notes API.
export const NOTES_CHANGED_EVENT = "provisuell:notes-changed"

export function announceNotesChanged(detail = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NOTES_CHANGED_EVENT, { detail }))
}

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "")

async function authHeader() {
  const user = auth.currentUser
  return user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}
}

// Upload a file or the voice note ("voice") to a note.
export async function uploadNoteFile(noteId, file, { kind = "file", durationSec } = {}) {
  const form = new FormData()
  form.append("file", file, file.name || (kind === "voice" ? "voice-note" : "file"))
  form.append("kind", kind)
  if (durationSec != null) form.append("durationSec", String(durationSec))
  return api.postForm(`/notes/${noteId}/attachments`, form)
}

// Attachments are private: fetched with the user's token, shown via a blob URL.
export async function fetchNoteFile(noteId, fileId) {
  const res = await fetch(`${API_ROOT}/notes/${noteId}/attachments/${fileId}`, { headers: await authHeader() })
  if (!res.ok) throw new Error(`Could not load the file (${res.status})`)
  return res.blob()
}

export function saveNote(noteId, body) {
  return noteId ? api.patch(`/notes/${noteId}`, body) : api.post("/notes", body)
}

// How many other people each sharing option reaches (cached briefly).
let audienceCache = null
export function fetchAudience() {
  if (audienceCache && audienceCache.at > Date.now() - 60000) return audienceCache.promise
  const promise = api.get("/notes?countOnly=1&withMeta=1").then((d) => d.audience || {})
  audienceCache = { at: Date.now(), promise }
  promise.catch(() => (audienceCache = null))
  return promise
}

// Staff a note can be shared with individually, plus per-role counts
// (only for people allowed to share; cached briefly).
let targetsCache = null
export function fetchShareTargets() {
  if (targetsCache && targetsCache.at > Date.now() - 60000) return targetsCache.promise
  const promise = api.get("/notes/share-targets")
  targetsCache = { at: Date.now(), promise }
  promise.catch(() => (targetsCache = null))
  return promise
}

// Who changed a note, newest first.
export function fetchNoteHistory(noteId) {
  return api.get(`/notes/${noteId}/history`)
}

// Quick reminder times, in Norway time: { key, date, time }.
export function quickReminderTimes(now = new Date()) {
  const { date, hour } = getNorwayNow(now)
  const options = []
  if (hour + 3 <= 22) options.push({ key: "laterToday", date, time: `${String(hour + 3).padStart(2, "0")}:00` })
  options.push({ key: "tomorrow", date: addDays(date, 1), time: "09:00" })
  options.push({ key: "nextWeek", date: addDays(date, 7 - weekdayIndex(date)), time: "09:00" })
  return options
}
