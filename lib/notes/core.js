// Pure Notes logic — no database, no clock of its own — shared by the API,
// the reminder processor, the UI and the tests.
import { addDays, osloParts, osloToUtc } from "../appointments/time.js"

export const NOTE_TYPES = ["text", "checklist"]
// Notes and to-dos live in the same collection (one reminder / privacy /
// email system), but are separate things in the UI and the API.
export const KINDS = ["note", "todo"]

// ---------------------------------------------------------------------------
// Privacy & sharing. A note is PRIVATE by default: only its creator sees it.
// Nobody ever sees it just because of a higher role. The creator may share
// it with any mix of staff roles and/or individual staff members, either
// view-only or with editing allowed:
//   visibility          "private" | "shared"
//   sharedRoles         ["administrator", "moderator", "owner"] (any subset)
//   sharedUserIds       individual staff members
//   allowSharedEditing  false = view only (default), true = may edit the text
// The Super Admin counts as an administrator for role sharing. Always
// combined with the notes.* permissions (lib/permissions.js).
// ---------------------------------------------------------------------------
export const SHARE_ROLES = ["administrator", "moderator", "owner"]
export const MAX_SHARED_USERS = 50

// Notes from before this model have only `sharedWith` (one group, no
// `visibility`). They keep their audience; editing by others is off.
export const SHARE_OPTIONS = ["private", "owner", "administrator", "everyone"]
export const LEGACY_SHARE_ROLES = { private: [], owner: ["owner"], administrator: ["administrator"], everyone: ["administrator", "owner"] }

// One canonical form for any id we compare: a Mongo ObjectId, a populated
// document ({ _id }), or a string all become the lowercase 24-hex string.
// (Firebase UIDs are never used for note access — only Mongo user ids.)
export function idString(value) {
  if (value == null) return ""
  if (typeof value === "object" && value._id !== undefined && typeof value.toHexString !== "function") return idString(value._id)
  return String(value).toLowerCase()
}

export function sameId(a, b) {
  const x = idString(a)
  return x !== "" && x === idString(b)
}

// The role a viewer shares under (the Super Admin counts as an administrator).
export function audienceRole(role) {
  return role === "superadmin" ? "administrator" : role
}

// Legacy one-group check, still used for notes saved before role lists.
export function inAudience(sharedWith, role) {
  return (LEGACY_SHARE_ROLES[sharedWith] || []).includes(audienceRole(role))
}

// A note's sharing, the same shape whether it was saved before or after
// role lists existed.
export function effectiveSharing(note) {
  const n = note || {}
  if (n.visibility === "private" || n.visibility === "shared") {
    const roles = SHARE_ROLES.filter((r) => (n.sharedRoles || []).includes(r))
    const userIds = [...new Set((n.sharedUserIds || []).map(idString).filter(Boolean))]
    const shared = n.visibility === "shared" && (roles.length > 0 || userIds.length > 0)
    return { visibility: shared ? "shared" : "private", roles: shared ? roles : [], userIds: shared ? userIds : [], allowEditing: shared && Boolean(n.allowSharedEditing) }
  }
  const roles = LEGACY_SHARE_ROLES[n.sharedWith] || []
  return { visibility: roles.length ? "shared" : "private", roles: [...roles], userIds: [], allowEditing: false }
}

// The old single-value summary ("private" | "owner" | "administrator" |
// "everyone"), or "custom" for anything that value can't express.
export function legacyShareValue(sharing) {
  if (sharing.visibility !== "shared") return "private"
  if (sharing.userIds.length) return "custom"
  const key = [...sharing.roles].sort().join(",")
  return { owner: "owner", administrator: "administrator", "administrator,owner": "everyone" }[key] || "custom"
}

// Is this viewer (not the creator) in the note's audience?
export function isSharedWith(sharing, { userId, role }) {
  if (sharing.visibility !== "shared") return false
  return sharing.roles.includes(audienceRole(role)) || sharing.userIds.includes(idString(userId))
}

// What a viewer may do with a note. `can(permission)` answers from the
// viewer's effective permissions. The creator keeps full control; others
// never delete, re-share or change the note's settings.
export function noteAccess(note, { userId, role, can }) {
  const isOwner = sameId(note.createdBy, userId)
  const sharing = effectiveSharing(note)
  const shared = !isOwner && isSharedWith(sharing, { userId, role })
  const canView = can("notes.view") && (isOwner || shared)
  const canEdit = canView && can("notes.edit") && (isOwner || sharing.allowEditing)
  return {
    isOwner,
    canView,
    canEdit,
    canDelete: isOwner && can("notes.delete"),
    canShare: isOwner && can("notes.share"),
    mode: !canView ? null : isOwner ? "owner" : canEdit ? "edit" : "view",
  }
}

// Sharing settings from a request body, before recipients are checked
// against the database. Accepts the current shape
//   { visibility, roles, userIds, allowEditing }
// or a legacy `sharedWith` value. Throws a plain Error on bad input.
export function parseSharing(input, legacyValue) {
  if (input == null) {
    if (!SHARE_OPTIONS.includes(legacyValue)) throw new Error("Invalid sharing option")
    const roles = LEGACY_SHARE_ROLES[legacyValue]
    return { visibility: roles.length ? "shared" : "private", roles: [...roles], userIds: [], allowEditing: false }
  }
  if (typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid sharing option")
  if (input.visibility !== undefined && !["private", "shared"].includes(input.visibility)) throw new Error("Invalid sharing option")
  const rawRoles = input.roles ?? []
  const rawUsers = input.userIds ?? []
  if (!Array.isArray(rawRoles) || !Array.isArray(rawUsers)) throw new Error("Invalid sharing option")
  if (rawRoles.some((r) => !SHARE_ROLES.includes(r))) throw new Error("Invalid sharing option")
  if (rawUsers.some((id) => typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id))) throw new Error("Invalid share recipient")
  if (rawUsers.length > MAX_SHARED_USERS) throw new Error("Too many share recipients")
  const roles = SHARE_ROLES.filter((r) => rawRoles.includes(r))
  const userIds = [...new Set(rawUsers.map((id) => id.toLowerCase()))]
  const shared = input.visibility !== "private" && (roles.length > 0 || userIds.length > 0)
  return {
    visibility: shared ? "shared" : "private",
    roles: shared ? roles : [],
    userIds: shared ? userIds : [],
    allowEditing: shared && input.allowEditing === true,
  }
}

// The note fields sharing is stored in.
export function sharingFields(sharing) {
  return {
    visibility: sharing.visibility,
    sharedRoles: sharing.roles,
    sharedUserIds: sharing.userIds,
    allowSharedEditing: sharing.allowEditing,
    // Legacy single-group value, kept in step where it can express the
    // audience (otherwise "private", so an older reader never widens access).
    sharedWith: ["owner", "administrator", "everyone"].includes(legacyShareValue(sharing)) ? legacyShareValue(sharing) : "private",
  }
}

// Which content fields an edit actually changed (autosave often re-sends
// the same text). Only these count as an edit for "last edited by".
export const CONTENT_FIELDS = ["title", "content", "checklistItems", "isCompleted"]
export function changedContentFields(before, fields) {
  const items = (list) => JSON.stringify((list || []).map((i) => [String(i.text), Boolean(i.completed)]))
  return CONTENT_FIELDS.filter((key) => {
    if (!(key in fields)) return false
    if (key === "checklistItems") return items(before?.checklistItems) !== items(fields.checklistItems)
    if (key === "isCompleted") return Boolean(before?.isCompleted) !== Boolean(fields.isCompleted)
    return String(before?.[key] ?? "") !== String(fields[key] ?? "")
  })
}
export const RECURRENCES = ["none", "daily", "weekly", "monthly", "custom"]
export const CUSTOM_UNITS = ["days", "weeks", "months"]
// Records a note can be attached to. `id` is a record id, or for reports the
// month ("2026-09").
export const RELATED_TYPES = ["order", "appointment", "invoice", "expense", "customer", "report"]

export const LIMITS = {
  title: 200,
  content: 20000,
  checklistItems: 100,
  checklistText: 500,
  tags: 20,
  tagLength: 40,
  label: 200,
  attachments: 10,
}

// ---------------------------------------------------------------------------
// Tags — free text, just tidied: trimmed, inner whitespace collapsed, and
// case-insensitive duplicates dropped (the first spelling is kept as typed).
// ---------------------------------------------------------------------------
export function normalizeTags(input) {
  const list = Array.isArray(input) ? input : String(input ?? "").split(",")
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const tag = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.tagLength)
    if (!tag) continue
    const key = tag.toLocaleLowerCase("nb")
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= LIMITS.tags) break
  }
  return out
}

// ---------------------------------------------------------------------------
// Search — every word of title, content, checklist items, tags and the
// related-record label is indexed as lowercase, accent-folded prefixes, so
// "matte", "custom" or "packag" all find "Call customer regarding matte
// black packaging". Stored in an indexed array → fast $all lookups.
// ---------------------------------------------------------------------------
const MAX_PREFIX = 20
const MIN_PREFIX = 2
const MAX_TOKENS = 4000

export function foldText(s) {
  return String(s ?? "")
    .toLocaleLowerCase("nb")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // Letters without a Unicode decomposition (å already folds to a).
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
}

export function words(s) {
  return foldText(s).match(/[\p{L}\p{N}]+/gu) || []
}

export function buildSearchTokens(note) {
  const text = [
    note.title,
    note.content,
    ...(note.checklistItems || []).map((i) => i.text),
    ...(note.tags || []),
    note.relatedEntityLabel,
  ].join(" ")
  const tokens = new Set()
  for (const w of words(text)) {
    const max = Math.min(w.length, MAX_PREFIX)
    for (let n = Math.min(MIN_PREFIX, max); n <= max; n++) tokens.add(w.slice(0, n))
    if (tokens.size >= MAX_TOKENS) break
  }
  return [...tokens]
}

// Query → terms that must all match (each as a word prefix).
export function searchTerms(query) {
  return [...new Set(words(query).map((w) => w.slice(0, MAX_PREFIX)))].slice(0, 10)
}

// ---------------------------------------------------------------------------
// Reminders (Europe/Oslo wall-clock, DST-safe)
// ---------------------------------------------------------------------------
function addMonthsKeepingTime(instant, months) {
  const p = osloParts(instant)
  const total = p.year * 12 + (p.month - 1) + months
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const d = Math.min(p.day, lastDay)
  const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  return osloToUtc(date, p.time) || osloToUtc(date, "12:00")
}

function addDaysKeepingTime(instant, days) {
  const p = osloParts(instant)
  const date = addDays(p.date, days)
  // A time skipped by the spring DST change moves to the next valid hour.
  return osloToUtc(date, p.time) || osloToUtc(date, `${String(p.hour + 1).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`)
}

// The k-th occurrence after `anchor` (k = 0 is the anchor itself). Always
// counted from the anchor, so a monthly reminder on the 31st comes back to
// the 31st after a short month instead of drifting to the 28th.
export function occurrence(anchor, k, { recurrence, customEvery = 1, customUnit = "days" }) {
  const n = Math.max(1, Math.min(365, Number(customEvery) || 1))
  switch (recurrence) {
    case "daily":
      return addDaysKeepingTime(anchor, k)
    case "weekly":
      return addDaysKeepingTime(anchor, 7 * k)
    case "monthly":
      return addMonthsKeepingTime(anchor, k)
    case "custom":
      if (customUnit === "weeks") return addDaysKeepingTime(anchor, 7 * n * k)
      if (customUnit === "months") return addMonthsKeepingTime(anchor, n * k)
      return addDaysKeepingTime(anchor, n * k)
    default:
      return null
  }
}

// One step of a recurrence from `instant`.
export function stepRecurrence(instant, reminder) {
  return occurrence(instant, 1, reminder)
}

const APPROX_PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 28 }

// The first occurrence (counted from `anchor`) strictly after `now` — a
// server that was down skips the missed ones instead of sending a burst.
export function nextOccurrenceAfter(anchor, reminder, now) {
  if (!reminder?.recurrence || reminder.recurrence === "none") return null
  const start = new Date(anchor)
  const n = Math.max(1, Number(reminder.customEvery) || 1)
  const periodDays =
    reminder.recurrence === "custom"
      ? n * (reminder.customUnit === "weeks" ? 7 : reminder.customUnit === "months" ? 28 : 1)
      : APPROX_PERIOD_DAYS[reminder.recurrence]
  // Jump close to `now`, then walk forward (the period estimate is a lower bound).
  let k = Math.max(1, Math.floor((now - start) / (periodDays * 86400000)) - 2)
  for (let guard = 0; guard < 400; guard++, k++) {
    const next = occurrence(start, k, reminder)
    if (next && next > now) return next
  }
  return null
}

export const DEFAULT_FOLLOW_UP_HOURS = 24

// What happens to a reminder once it has fired at `firedAt`:
//  - recurring: next occurrence (while unfinished only, if "repeat if unfinished")
//  - one-time + "remind again if unfinished": a follow-up while incomplete
//  - one-time: done
export function nextAfterFiring(note, firedAt) {
  const r = note.reminder || {}
  // A done to-do (or a done "if unfinished" note) never reminds again.
  if ((r.onlyIfUnfinished || note.kind === "todo") && note.isCompleted) return null
  if (r.recurrence && r.recurrence !== "none") return nextOccurrenceAfter(r.at || r.nextAt || firedAt, r, firedAt)
  if (r.onlyIfUnfinished) {
    const hours = Math.max(1, Math.min(24 * 30, Number(r.followUpHours) || DEFAULT_FOLLOW_UP_HOURS))
    return new Date(firedAt.getTime() + hours * 3600000)
  }
  return null
}

// Should this due reminder fire at all? (Stops "if unfinished" reminders on
// completed notes, and anything on archived notes.)
export function shouldFire(note) {
  const r = note.reminder || {}
  if (!r.enabled || note.archived) return false
  if ((r.onlyIfUnfinished || note.kind === "todo") && note.isCompleted) return false
  return true
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------
export function checklistProgress(note) {
  const items = note.checklistItems || []
  return { done: items.filter((i) => i.completed).length, total: items.length }
}

// Where a related record lives in the dashboard (`base`: /dashboard/admin or /dashboard/owner).
export function relatedHref(related, base) {
  if (!related?.type) return null
  const id = encodeURIComponent(related.id || "")
  switch (related.type) {
    case "order":
      return `${base}/ordreoversikt?search=${encodeURIComponent(related.ref || "")}`
    case "appointment":
      return `${base}/ansattmoter?appointment=${id}`
    case "invoice":
      return `/faktura/${id}`
    case "expense":
      return `${base}/utgifter`
    case "customer":
      return `${base}/kundebetalinger`
    case "report":
      return `${base}/rapporter?month=${id}`
    default:
      return null
  }
}
