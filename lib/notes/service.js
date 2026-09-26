import mongoose from "mongoose"
import { ApiError } from "../apiError.js"
import { can, isProtectedSuperAdmin, superAdminEmail, userPermissions } from "../access.js"
import { STAFF_ROLES } from "../permissions.js"
import { getRolePermissionConfig } from "../rolePermissions.js"
import { deletePrivateFile } from "../privateStorage.js"
import { connectDB } from "../db.js"
import { sendEmail } from "../mailer.js"
import { notifyUser } from "../notify.js"
import { Note } from "../models/Note.js"
import { User } from "../models/User.js"
import { Notification } from "../models/Notification.js"
import { SystemConfig } from "../models/SystemConfig.js"
import { Order } from "../models/Order.js"
import { Appointment } from "../models/Appointment.js"
import { Invoice } from "../models/Invoice.js"
import { Expense } from "../models/Expense.js"
import { isValidDateString, normalizeAppointmentTime, osloToUtc } from "../appointments/time.js"
import {
  CUSTOM_UNITS,
  KINDS,
  LIMITS,
  NOTE_TYPES,
  RECURRENCES,
  RELATED_TYPES,
  SHARE_OPTIONS,
  SHARE_ROLES,
  audienceRole,
  sameId,
  buildSearchTokens,
  changedContentFields,
  checklistProgress,
  effectiveSharing,
  isSharedWith,
  legacyShareValue,
  nextAfterFiring,
  nextOccurrenceAfter,
  noteAccess,
  normalizeTags,
  parseSharing,
  sharingFields,
  shouldFire,
} from "./core.js"
import { renderReminderEmail } from "./email.js"
import { contentSnapshot, deleteNoteHistory, recordNoteEdit } from "./history.js"

// Server side of Notes and To-dos: privacy, validation, the related-record
// lookup, serialization and the reminder / expiry processor. Every caller has
// already passed requirePermission(auth, "notes.view"); on top of that, every
// note is private to its creator unless explicitly shared (see accessFilter),
// and what a viewer may do with a note is decided by noteAccessFor().

const clean = (v, max) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max)

// Permission needed to see (and attach notes to) each kind of record.
const RELATED_PERMISSION = {
  order: "orders.view",
  appointment: "appointments.view",
  invoice: "invoices.view",
  expense: "expenses.view",
  customer: "customers.viewBasic",
  report: "reports.view",
}

// ---------------------------------------------------------------------------
// Related records — verified and labelled from the database, never from the
// request, so a note always points at something real.
// ---------------------------------------------------------------------------
export async function resolveRelated(auth, type, rawId) {
  if (!type) return { relatedEntityType: null, relatedEntityId: null, relatedEntityLabel: "", relatedEntityRef: "" }
  if (!RELATED_TYPES.includes(type)) throw new ApiError(400, "Invalid related record")
  if (!can(auth, RELATED_PERMISSION[type])) throw new ApiError(403, "Not allowed for your role")
  const id = String(rawId ?? "").trim()
  const found = (label, ref = "") => ({ relatedEntityType: type, relatedEntityId: id, relatedEntityLabel: clean(label, LIMITS.label), relatedEntityRef: clean(ref, 60) })
  const notFound = () => new ApiError(404, "Related record not found")

  if (type === "report") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(id)) throw notFound()
    return found(id, id)
  }
  if (type === "customer") {
    // Customer rows are keyed by account id, or "email:<address>" for walk-ins.
    if (id.startsWith("email:")) {
      const email = id.slice(6)
      const inv = await Invoice.findOne({ "customer.email": email }).select("customer").lean()
      if (!inv) throw notFound()
      return found(inv.customer?.name || email, email)
    }
    if (!mongoose.isValidObjectId(id)) throw notFound()
    const user = await User.findById(id).select("name email").lean()
    if (!user) throw notFound()
    return found(user.name || user.email, user.email)
  }
  if (!mongoose.isValidObjectId(id)) throw notFound()
  if (type === "order") {
    const o = await Order.findById(id).select("orderNumber customerName service").lean()
    if (!o) throw notFound()
    return found(`#${o.orderNumber} — ${o.customerName}${o.service ? ` (${o.service})` : ""}`, String(o.orderNumber))
  }
  if (type === "appointment") {
    const a = await Appointment.findById(id).select("title requestedByName start").lean()
    if (!a) throw notFound()
    return found(`${a.title} — ${a.requestedByName}`, new Date(a.start).toISOString())
  }
  if (type === "invoice") {
    const i = await Invoice.findById(id).select("invoiceNumber customer").lean()
    if (!i) throw notFound()
    return found(`${i.invoiceNumber} — ${i.customer?.name || ""}`, i.invoiceNumber)
  }
  if (type === "expense") {
    const e = await Expense.findById(id).select("category amount date note").lean()
    if (!e) throw notFound()
    const day = new Date(e.date).toISOString().slice(0, 10)
    return found(`${e.category} · ${Number(e.amount).toLocaleString("no-NO")} kr · ${day}${e.note ? ` · ${e.note}` : ""}`, day)
  }
  throw notFound()
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function parseInstant(value, { dateOnly = false } = {}) {
  if (value == null || value === "") return null
  // { date: "YYYY-MM-DD", time: "HH:MM" } in Europe/Oslo — the business timezone.
  if (typeof value === "object" && value.date) {
    if (!isValidDateString(value.date)) throw new ApiError(400, "Invalid date")
    const time = dateOnly ? "23:59" : normalizeAppointmentTime(value.time || "09:00")
    if (!time) throw new ApiError(400, "Invalid time")
    const at = osloToUtc(value.date, time)
    if (!at) throw new ApiError(400, "That time doesn't exist on this date (daylight saving change)")
    return at
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new ApiError(400, "Invalid date")
  return d
}

function cleanChecklist(items, existing = []) {
  if (!Array.isArray(items)) throw new ApiError(400, "Invalid checklist")
  if (items.length > LIMITS.checklistItems) throw new ApiError(400, "Too many checklist items")
  const byId = new Map(existing.map((i) => [String(i._id), i]))
  return items
    .map((i) => {
      const text = clean(i?.text, LIMITS.checklistText)
      if (!text) return null
      const keep = i?._id && byId.has(String(i._id)) ? { _id: byId.get(String(i._id))._id } : {}
      return { ...keep, text, completed: Boolean(i?.completed) }
    })
    .filter(Boolean)
}

// Reminder settings from the request. Returns the new `reminder` subdocument.
function cleanReminder(input, existing, userId, now) {
  const r = input || {}
  const prev = existing?.reminder || {}
  if (!r.enabled) {
    // No reminder: nothing is scheduled and no email is ever sent.
    return { ...plain(prev), enabled: false, email: false, nextAt: null }
  }
  const recurrence = RECURRENCES.includes(r.recurrence) ? r.recurrence : "none"
  const customUnit = CUSTOM_UNITS.includes(r.customUnit) ? r.customUnit : "days"
  const customEvery = Math.max(1, Math.min(365, Math.round(Number(r.customEvery) || 1)))
  const followUpHours = Math.max(1, Math.min(24 * 30, Math.round(Number(r.followUpHours) || 24)))
  const at = parseInstant(r.at)
  if (!at) throw new ApiError(400, "Pick a reminder date and time")

  const settings = {
    enabled: true,
    at,
    email: Boolean(r.email),
    recurrence,
    customEvery,
    customUnit,
    onlyIfUnfinished: Boolean(r.onlyIfUnfinished),
    followUpHours,
  }
  const changed =
    !prev.enabled ||
    !prev.at ||
    new Date(prev.at).getTime() !== at.getTime() ||
    prev.recurrence !== recurrence ||
    prev.customEvery !== customEvery ||
    prev.customUnit !== customUnit ||
    Boolean(prev.onlyIfUnfinished) !== settings.onlyIfUnfinished ||
    prev.followUpHours !== followUpHours
  if (!changed) {
    // Same schedule: keep the processor's state (next run, sent count).
    return { ...plain(prev), ...settings, recipient: userId }
  }
  let nextAt = at
  if (at <= now) {
    if (recurrence === "none") throw new ApiError(400, "The reminder time must be in the future")
    nextAt = nextOccurrenceAfter(at, settings, now)
  }
  return { ...settings, recipient: userId, nextAt, lastSentAt: prev.lastSentAt || null, sentCount: prev.sentCount || 0, lastError: "" }
}

function plain(sub) {
  return sub && typeof sub.toObject === "function" ? sub.toObject() : { ...(sub || {}) }
}

// ---------------------------------------------------------------------------
// Privacy — every read and write goes through these.
// ---------------------------------------------------------------------------

// Mongo filter for the notes this user may see: their own, plus notes
// explicitly shared with their role or with them personally. No role sees
// private notes.
export function accessFilter(auth) {
  const me = auth.user._id
  const role = audienceRole(auth.access.role)
  const clauses = [{ createdBy: me }, { visibility: "shared", sharedUserIds: me }]
  if (SHARE_ROLES.includes(role)) {
    clauses.push({ visibility: "shared", sharedRoles: role })
    // Notes saved before role lists (no `visibility`) keep their one group.
    const legacy = SHARE_OPTIONS.filter((s) => s !== "private" && effectiveSharing({ sharedWith: s }).roles.includes(role))
    if (legacy.length) clauses.push({ visibility: { $exists: false }, sharedWith: { $in: legacy } })
  }
  return { $or: clauses }
}

// Mongo filter for "shared with me": visible notes someone else created.
export function sharedWithMeFilter(auth) {
  return { $and: [accessFilter(auth), { createdBy: { $ne: auth.user._id } }] }
}

// Mongo filter for the viewer's own notes that they've shared with someone.
export function sharedByMeFilter(auth) {
  return {
    createdBy: auth.user._id,
    $or: [{ visibility: "shared" }, { visibility: { $exists: false }, sharedWith: { $in: ["owner", "administrator", "everyone"] } }],
  }
}

export function isNoteOwner(auth, note) {
  return sameId(note.createdBy, auth.user._id)
}

// What this viewer may do with the note (core.js noteAccess). The Mongo
// filter above (accessFilter) and this function implement the same rules —
// one decides which notes a query returns, the other what may be done with
// a loaded note.
export function noteAccessFor(auth, note) {
  return noteAccess(note, { userId: auth.user._id, role: auth.access.role, can: (p) => can(auth, p) })
}

export function canViewNote(auth, note) {
  return noteAccessFor(auth, note).canView
}
export const canSeeNote = canViewNote

export function canEditNote(auth, note) {
  return noteAccessFor(auth, note).canEdit
}

// Refuses (loudly) to write a field the loaded Note model doesn't know.
// Mongoose's strict mode would otherwise drop it without a word — a shared
// note would be saved as private (see lib/models/registerModel.js).
export function assertKnownNoteFields(fields) {
  const unknown = Object.keys(fields).filter((key) => Note.schema.pathType(key) === "adhocOrUndefined")
  if (unknown.length) {
    console.error(`Note model is missing fields [${unknown.join(", ")}] — the server is running an outdated schema; restart it.`)
    throw new ApiError(500, "Note schema out of date")
  }
}

// A note this user may see, or 404 — the same answer whether it doesn't
// exist or isn't theirs, so ids can't be probed.
export async function findAccessibleNote(auth, id, { select } = {}) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Note not found")
  let q = Note.findOne({ _id: id, ...accessFilter(auth) })
  if (select) q = q.select(select)
  const note = await q
  if (!note) throw new ApiError(404, "Note not found")
  return note
}

// The permission checks behind each kind of change, in one place.
export function assertCanEdit(auth, note) {
  const access = noteAccessFor(auth, note)
  if (access.isOwner && !access.canEdit) throw new ApiError(403, "Not allowed for your role")
  if (!access.canEdit) throw new ApiError(403, "You have view-only access to this note")
  return access
}

export function assertCanDelete(auth, note) {
  const access = noteAccessFor(auth, note)
  if (!access.isOwner) throw new ApiError(403, "Only the note's creator can change this")
  if (!access.canDelete) throw new ApiError(403, "Not allowed for your role")
  return access
}

// Everyone who can use Notes at all — staff and the Super Admin (whatever
// role is stored for them) — each with the role that decides which shared
// notes they see. A couple of queries per call.
const AUDIENCE_FIELDS = "email name role status language timeFormat permissionGrants permissionDenies firebaseUid linkedFirebaseUids"
async function notesStaff() {
  const [candidates, pin, roleConfig] = await Promise.all([
    User.find({
      status: { $ne: "banned" },
      $or: [{ role: { $in: STAFF_ROLES } }, { permissionGrants: { $in: ["notes.view", "notes.use"] } }],
    })
      .select(AUDIENCE_FIELDS)
      .lean(),
    SystemConfig.findOne({ key: "superadmin" }).lean(),
    getRolePermissionConfig(),
  ])
  const email = superAdminEmail()
  const saQuery = pin?.firebaseUid ? { $or: [{ firebaseUid: pin.firebaseUid }, { linkedFirebaseUids: pin.firebaseUid }] } : email ? { email } : null
  const isPinned = (u) => u.firebaseUid === pin.firebaseUid || (u.linkedFirebaseUids || []).includes(pin.firebaseUid)
  if (saQuery && !candidates.some((u) => (pin?.firebaseUid ? isPinned(u) : String(u.email).toLowerCase() === email))) {
    const sa = await User.findOne(saQuery).select(AUDIENCE_FIELDS).lean()
    if (sa) candidates.push(sa)
  }
  const staff = []
  for (const u of candidates) {
    if (await isProtectedSuperAdmin(u)) staff.push({ user: u, role: "superadmin" })
    else if (u.status !== "banned" && userPermissions(u, roleConfig).includes("notes.view")) staff.push({ user: u, role: u.role })
  }
  return staff
}

// Users who get a note's reminders (and may see it): the creator plus
// everyone it's shared with, each still holding "notes.view". Deduplicated.
export async function noteAudience(note, staff = null) {
  const everyone = staff || (await notesStaff())
  const sharing = effectiveSharing(note)
  const people = new Map()
  for (const { user, role } of everyone) {
    if (String(user._id) === String(note.createdBy) || isSharedWith(sharing, { userId: user._id, role })) people.set(String(user._id), user)
  }
  return [...people.values()]
}

// How many other people each role reaches (for the share picker), keyed by
// role plus the legacy group names older clients ask for.
export async function audienceCounts(auth) {
  const staff = (await notesStaff()).filter(({ user }) => String(user._id) !== String(auth.user._id))
  const reach = (sharing) => staff.filter(({ user, role }) => isSharedWith(sharing, { userId: user._id, role })).length
  const counts = { private: 0 }
  for (const option of SHARE_OPTIONS.filter((o) => o !== "private")) counts[option] = reach(effectiveSharing({ sharedWith: option }))
  counts.moderator = reach({ visibility: "shared", roles: ["moderator"], userIds: [] })
  return counts
}

// Staff a note can be shared with individually (for the share picker).
export async function shareTargets(auth) {
  const staff = await notesStaff()
  return staff
    .filter(({ user }) => String(user._id) !== String(auth.user._id))
    .map(({ user, role }) => ({ _id: String(user._id), name: user.name || user.email, email: user.email, role }))
    .sort((a, b) => a.name.localeCompare(b.name, "nb"))
}

// Sharing settings from a request, with every individual recipient checked
// against the database: an existing, unbanned staff member who can use
// Notes, and never the creator.
async function resolveSharing(body, creatorId) {
  let sharing
  try {
    sharing = parseSharing(body.sharing, body.sharedWith)
  } catch (err) {
    throw new ApiError(400, err.message)
  }
  if (sharing.userIds.length) {
    const allowed = new Set((await notesStaff()).map(({ user }) => String(user._id)))
    const ids = sharing.userIds.filter((id) => id !== String(creatorId))
    if (ids.some((id) => !allowed.has(id))) throw new ApiError(400, "Invalid share recipient")
    sharing.userIds = ids
    if (!sharing.roles.length && !ids.length) sharing = { visibility: "private", roles: [], userIds: [], allowEditing: false }
  }
  return sharing
}

// After sharing is narrowed: remove this note's reminder notifications from
// the dashboards of people who can no longer see it.
export async function pruneNoteNotifications(note) {
  const keep = (await noteAudience(note)).map((u) => u._id)
  await Notification.deleteMany({ type: "note_reminder", "data.noteId": String(note._id), user: { $nin: keep } })
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

// Fields people a note is shared with may change — and only when the creator
// allowed editing. Everything else (sharing, reminder, due date, archive,
// expiry, files, deleting) is the creator's alone.
const SHARED_EDITABLE = ["title", "content", "isCompleted", "checklistItems"]
const SHARING_KEYS = ["sharing", "sharedWith"]

// Validates a create / update body into note fields. `existing` for updates.
// Every permission check for a create or an edit happens here, from the
// server-side identity — nothing in the body (creator, role, access mode) is
// trusted.
export async function buildNoteFields(auth, body, existing = null) {
  const now = new Date()
  const b = { ...(body || {}) }
  const out = {}
  const keys = Object.keys(b).filter((k) => k !== "isPinned")
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const touchesSharing = SHARING_KEYS.some(has)

  if (!existing) {
    if (!can(auth, "notes.create")) throw new ApiError(403, "Not allowed for your role")
  } else {
    const access = noteAccessFor(auth, existing)
    if (!access.isOwner) {
      if (keys.some((k) => !SHARED_EDITABLE.includes(k))) throw new ApiError(403, "Only the note's creator can change this")
      if (keys.length && !access.canEdit) throw new ApiError(403, "You have view-only access to this note")
    } else {
      if (touchesSharing && !access.canShare) throw new ApiError(403, "Not allowed for your role")
      if (keys.some((k) => !SHARING_KEYS.includes(k)) && !access.canEdit) throw new ApiError(403, "Not allowed for your role")
    }
  }

  if (!existing || touchesSharing) {
    const sharing = touchesSharing ? await resolveSharing(b, existing?.createdBy ?? auth.user._id) : parseSharing(null, "private")
    if (!existing && sharing.visibility === "shared" && !can(auth, "notes.share")) throw new ApiError(403, "Not allowed for your role")
    Object.assign(out, sharingFields(sharing))
  }

  if (!existing) {
    const kind = b.kind ?? "note"
    if (!KINDS.includes(kind)) throw new ApiError(400, "Invalid note type")
    out.kind = kind
  }
  const kind = out.kind ?? existing?.kind ?? "note"
  if (!existing || has("type")) {
    const type = b.type ?? "text"
    if (!NOTE_TYPES.includes(type)) throw new ApiError(400, "Invalid note type")
    out.type = kind === "todo" ? "text" : type
  }
  if (!existing || has("title")) out.title = clean(b.title, LIMITS.title)
  if (!existing || has("content")) out.content = clean(b.content, LIMITS.content)
  if (!existing || has("checklistItems")) out.checklistItems = cleanChecklist(b.checklistItems || [], existing?.checklistItems || [])
  if (!existing || has("tags")) out.tags = normalizeTags(b.tags || existing?.tags || [])
  if (!existing || has("dueDate")) {
    if (b.dueDate != null && b.dueDate !== "" && !isValidDateString(b.dueDate)) throw new ApiError(400, "Invalid date")
    out.dueDate = kind === "todo" && b.dueDate ? b.dueDate : null
  }
  if (has("archived")) {
    out.archived = Boolean(b.archived)
    out.archivedAt = out.archived ? now : null
    out.archiveReason = out.archived ? "manual" : null
  }
  if (has("expiresAt")) {
    out.expiresAt = parseInstant(b.expiresAt, { dateOnly: true })
    if (out.expiresAt && out.expiresAt <= now) throw new ApiError(400, "The expiry date must be in the future")
    if (existing?.archiveReason === "expired" && !has("archived")) {
      out.archived = false
      out.archivedAt = null
      out.archiveReason = null
    }
  }
  // Only when creating: which record the note belongs to (fixed afterwards).
  if (!existing) Object.assign(out, await resolveRelated(auth, b.relatedEntityType || null, b.relatedEntityId))
  if (!existing || has("reminder")) out.reminder = cleanReminder(b.reminder, existing, auth.user._id, now)

  // Completion: explicit, or derived when a checklist's items change.
  const type = out.type ?? existing?.type
  const items = out.checklistItems ?? existing?.checklistItems ?? []
  if (has("isCompleted")) {
    out.isCompleted = Boolean(b.isCompleted)
  } else if (out.checklistItems && type === "checklist" && has("checklistItems")) {
    const { done, total } = checklistProgress({ checklistItems: items })
    out.isCompleted = total > 0 && done === total
  }
  if (out.isCompleted !== undefined) {
    const wasCompleted = Boolean(existing?.isCompleted)
    if (out.isCompleted && !wasCompleted) out.completedAt = now
    if (!out.isCompleted) out.completedAt = null
  }

  // Something has to be in it (a to-do needs its task text).
  const title = out.title ?? existing?.title ?? ""
  const content = out.content ?? existing?.content ?? ""
  if (kind === "todo" && !title) throw new ApiError(400, "Write the task")
  if (!title && !content && !items.length && !existing?.attachments?.length && !existing?.voiceNote) {
    throw new ApiError(400, "Write a title, some text or a checklist item")
  }
  return out
}

export function applySearchTokens(doc) {
  doc.searchTokens = buildSearchTokens(doc)
}

// ---------------------------------------------------------------------------
// Output — the only shape that leaves the server (no storage names, no
// tokens, no other people's ids or emails).
// ---------------------------------------------------------------------------
function publicFile(f) {
  if (!f) return null
  return { _id: f._id, fileName: f.fileName, mimeType: f.mimeType, size: f.size, kind: f.kind, durationSec: f.durationSec ?? null, uploadedAt: f.uploadedAt }
}

export function canDeleteNote(auth, note) {
  // Privacy first: only the creator deletes.
  return noteAccessFor(auth, note).canDelete
}

// Names for the people a note is shared with individually (creator's view
// only). One query for a whole page of notes.
export async function shareRecipientNames(notes) {
  const ids = [...new Set(notes.flatMap((n) => (n.sharedUserIds || []).map(String)))]
  if (!ids.length) return new Map()
  const users = await User.find({ _id: { $in: ids } }).select("name email role").lean()
  return new Map(users.map((u) => [String(u._id), { _id: String(u._id), name: u.name || u.email, role: u.role }]))
}

function pinnedFor(auth, n) {
  const me = String(auth.user._id)
  if ((n.pinnedBy || []).some((id) => String(id) === me)) return true
  // Legacy pin (before per-user pins): the creator's.
  return Boolean(n.isPinned) && String(n.createdBy) === me
}

// `recipients` (optional): shareRecipientNames() for this note's page.
export function serializeNote(note, auth, recipients = null) {
  const n = typeof note.toObject === "function" ? note.toObject() : note
  const relatedVisible = !n.relatedEntityType || can(auth, RELATED_PERMISSION[n.relatedEntityType])
  const r = n.reminder || {}
  const access = noteAccessFor(auth, n)
  const owner = access.isOwner
  const sharing = effectiveSharing(n)
  return {
    _id: n._id,
    kind: n.kind || "note",
    type: n.type,
    title: n.title,
    content: n.content,
    dueDate: n.dueDate || null,
    checklistItems: (n.checklistItems || []).map((i) => ({ _id: i._id, text: i.text, completed: i.completed })),
    tags: n.tags || [],
    related: n.relatedEntityType
      ? {
          type: n.relatedEntityType,
          id: relatedVisible ? n.relatedEntityId : null,
          label: relatedVisible ? n.relatedEntityLabel : "",
          ref: relatedVisible ? n.relatedEntityRef : "",
        }
      : null,
    isOwner: owner,
    createdByName: n.createdByName,
    createdByRole: n.createdByRole || "",
    // What the viewer may do: "owner" | "edit" | "view".
    access: { mode: access.mode, canEdit: access.canEdit, canDelete: access.canDelete, canShare: access.canShare },
    sharing: {
      visibility: sharing.visibility,
      roles: sharing.roles,
      allowEditing: sharing.allowEditing,
      // Who else it's shared with personally — the creator's business only.
      users: owner ? sharing.userIds.map((id) => recipients?.get(id) || { _id: id, name: "", role: "" }) : [],
      sharedWithMe: !owner,
    },
    // Summary in the old single-value form ("custom" when it can't express it).
    sharedWith: legacyShareValue(sharing),
    lastEdited: n.lastEditedAt ? { name: n.lastEditedByName, role: n.lastEditedByRole, at: n.lastEditedAt, byMe: String(n.lastEditedBy) === String(auth.user._id) } : null,
    isPinned: pinnedFor(auth, n),
    isCompleted: n.isCompleted,
    completedAt: n.completedAt,
    archived: n.archived,
    archivedAt: n.archivedAt,
    archiveReason: n.archiveReason,
    expiresAt: n.expiresAt,
    reminder: {
      enabled: Boolean(r.enabled),
      at: r.at || null,
      email: Boolean(r.email),
      recurrence: r.recurrence || "none",
      customEvery: r.customEvery || 1,
      customUnit: r.customUnit || "days",
      onlyIfUnfinished: Boolean(r.onlyIfUnfinished),
      followUpHours: r.followUpHours || 24,
      nextAt: r.nextAt || null,
      lastSentAt: r.lastSentAt || null,
    },
    attachments: (n.attachments || []).map(publicFile),
    voiceNote: publicFile(n.voiceNote),
    progress: checklistProgress(n),
    canDelete: access.canDelete,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }
}

// Applies validated fields to a loaded note and, when its text / checklist /
// done state really changed, records who changed it (last editor + history).
// The creator fields are never touched.
export async function applyNoteEdit(auth, note, fields, now = new Date()) {
  const before = contentSnapshot(note)
  const changed = changedContentFields(before, fields)
  // A legacy note gets the current sharing fields on its first save.
  if (!note.visibility && !("visibility" in fields)) Object.assign(fields, sharingFields(effectiveSharing(note)))
  assertKnownNoteFields(fields)
  note.set({ ...fields, updatedBy: auth.user._id })
  if (changed.length) {
    const editor = { id: auth.user._id, name: auth.user.name || auth.user.email, role: auth.access.role }
    note.set({ lastEditedBy: editor.id, lastEditedByName: editor.name, lastEditedByRole: editor.role, lastEditedAt: now })
    applySearchTokens(note)
    await note.save()
    await recordNoteEdit({ noteId: note._id, editor, previous: before, updated: contentSnapshot(note), fields: changed, at: now })
    return note
  }
  applySearchTokens(note)
  await note.save()
  return note
}

// Deletes notes with everything that hangs off them (files, history,
// reminder notifications).
export async function removeNotes(notes) {
  if (!notes.length) return
  const ids = notes.map((n) => n._id)
  const files = notes.flatMap((n) => [...(n.attachments || []), ...(n.voiceNote ? [n.voiceNote] : [])])
  await Note.deleteMany({ _id: { $in: ids } })
  await Promise.all([
    deleteNoteHistory(ids),
    Notification.deleteMany({ type: "note_reminder", "data.noteId": { $in: ids.map(String) } }),
    ...files.map((f) => deletePrivateFile("notes", f.storedName).catch(() => {})),
  ])
}

// A deleted account's notes go with it; it disappears from everyone else's
// sharing lists and pins.
export async function deleteNotesOfUser(userId) {
  await connectDB()
  const own = await Note.find({ createdBy: userId }).select("attachments voiceNote").lean()
  await removeNotes(own)
  await Note.updateMany({ $or: [{ sharedUserIds: userId }, { pinnedBy: userId }] }, { $pull: { sharedUserIds: userId, pinnedBy: userId } })
  await Note.updateMany({ "reminder.recipient": userId }, { $set: { "reminder.recipient": null } })
}

// ---------------------------------------------------------------------------
// Expiry + reminders — safe to run any number of times, from any number of
// processes (the in-process ticker, the cron route, several servers).
// ---------------------------------------------------------------------------
export async function archiveExpired(now = new Date()) {
  await connectDB()
  const res = await Note.updateMany(
    { archived: false, expiresAt: { $ne: null, $lte: now } },
    { $set: { archived: true, archivedAt: now, archiveReason: "expired", "reminder.nextAt": null } }
  )
  return res.modifiedCount || 0
}

function dashboardBase(user) {
  return user?.role === "owner" ? "/dashboard/owner" : "/dashboard/admin"
}

// The reminder goes to the creator and the note's shared-with group only —
// each gets their own dashboard notification and (if on) one email.
async function deliver(note, firedAt) {
  const recipients = await noteAudience(note)
  const creator = recipients.find((u) => String(u._id) === String(note.createdBy))
  const base = (process.env.CLIENT_URL || "").replace(/\/$/, "")
  const results = []
  for (const user of recipients) {
    const section = note.kind === "todo" ? "gjoremal" : "notater"
    const link = `${dashboardBase(user)}/${section}?${note.kind === "todo" ? "todo" : "note"}=${note._id}`
    const sharedBy = String(user._id) === String(note.createdBy) ? "" : note.createdByName || creator?.name || ""
    notifyUser(user._id, {
      type: "note_reminder",
      title: "Påminnelse",
      message: (note.title || note.content || "").slice(0, 80),
      link,
      data: { noteId: String(note._id), kind: note.kind || "note", title: note.title || "", at: firedAt, sharedBy },
    })
    if (!note.reminder?.email || !user.email) {
      results.push({ user: String(user._id), email: false, delivered: false })
      continue
    }
    const email = renderReminderEmail(note, { user, firedAt, url: base ? `${base}${link}` : "", sharedBy })
    const delivered = await sendEmail({ to: user.email, subject: email.subject, text: email.text, html: email.html })
    results.push({ user: String(user._id), email: true, delivered })
  }
  return results
}

export async function processDueReminders(now = new Date(), { limit = 50 } = {}) {
  await connectDB()
  const archived = await archiveExpired(now)
  const due = await Note.find({ "reminder.nextAt": { $ne: null, $lte: now } })
    .sort({ "reminder.nextAt": 1 })
    .limit(limit)
    .lean()

  const sent = []
  let skipped = 0
  for (const note of due) {
    const scheduledFor = note.reminder.nextAt
    if (!shouldFire(note)) {
      // Completed to-do / "if unfinished" reminder, archived note, disabled: stop it.
      await Note.updateOne({ _id: note._id, "reminder.nextAt": scheduledFor }, { $set: { "reminder.nextAt": null } })
      skipped++
      continue
    }
    const next = nextAfterFiring(note, now)
    // Compare-and-swap on the exact scheduled time: only one runner can move
    // it, so each occurrence is delivered at most once.
    const claimed = await Note.findOneAndUpdate(
      { _id: note._id, "reminder.nextAt": scheduledFor },
      { $set: { "reminder.nextAt": next, "reminder.lastSentAt": now, "reminder.lastError": "" }, $inc: { "reminder.sentCount": 1 } },
      { new: true }
    ).lean()
    if (!claimed) {
      skipped++
      continue
    }
    try {
      const recipients = await deliver(claimed, now)
      if (recipients.some((x) => x.email && !x.delivered)) {
        await Note.updateOne({ _id: note._id }, { $set: { "reminder.lastError": "Email could not be sent" } })
      }
      const anyEmail = recipients.some((x) => x.email)
      sent.push({ id: String(note._id), email: anyEmail, delivered: recipients.some((x) => x.delivered), recipients, nextAt: next })
    } catch (err) {
      console.error("Note reminder delivery failed:", err.message)
      await Note.updateOne({ _id: note._id }, { $set: { "reminder.lastError": String(err.message).slice(0, 200) } })
    }
  }
  return { archived, due: due.length, sent, skipped }
}
