// Notes: pure logic (no DB, no network).
import test from "node:test"
import assert from "node:assert/strict"
import {
  buildSearchTokens,
  changedContentFields,
  checklistProgress,
  effectiveSharing,
  idString,
  inAudience,
  sameId,
  legacyShareValue,
  nextAfterFiring,
  nextOccurrenceAfter,
  noteAccess,
  normalizeTags,
  parseSharing,
  relatedHref,
  searchTerms,
  shouldFire,
} from "../lib/notes/core.js"
import { NOTES_PERMISSIONS, computeEffectivePermissions, isGrantable } from "../lib/permissions.js"
import { validateUpload } from "../lib/notes/files.js"
import { renderReminderEmail } from "../lib/notes/email.js"
import { osloParts } from "../lib/appointments/time.js"

const matches = (note, query) => {
  const tokens = new Set(buildSearchTokens(note))
  return searchTerms(query).every((t) => tokens.has(t))
}

test("tags: free text, trimmed, case-insensitive duplicates dropped, wording kept", () => {
  assert.deepEqual(normalizeTags(["  customer   follow-up ", "Customer Follow-up", "urgent", "", "Supplier"]), ["customer follow-up", "urgent", "Supplier"])
  assert.deepEqual(normalizeTags("payment, production ,payment"), ["payment", "production"])
  assert.deepEqual(normalizeTags([]), [])
})

test("search: any word of title, content, checklist, tags or related record", () => {
  const note = {
    title: "Supplier call",
    content: "Call customer regarding matte black packaging",
    checklistItems: [{ text: "Order sample boxes" }],
    tags: ["urgent", "customer follow-up"],
    relatedEntityLabel: "#1045 — ABC AS",
  }
  for (const q of ["matte", "customer", "packaging", "Supplier", "sample boxes", "urgent", "follow", "ABC", "1045", "MATTE Packag"]) {
    assert.ok(matches(note, q), q)
  }
  assert.ok(!matches(note, "invoice"))
  assert.ok(!matches(note, "matte invoice"), "every term must match")
  // Accent-folded both ways.
  assert.ok(matches({ content: "Møte på kontoret" }, "mote kontoret"))
  assert.ok(matches({ content: "Café réunion" }, "cafe"))
})

test("recurrence: daily / weekly / monthly / custom follow Oslo wall-clock", () => {
  const at = new Date("2026-03-28T09:00:00Z") // 10:00 CET
  const daily = nextOccurrenceAfter(at, { recurrence: "daily" }, at)
  assert.equal(osloParts(daily).date, "2026-03-29")
  assert.equal(osloParts(daily).time, "10:00", "10:00 kept across the DST change")
  assert.equal(osloParts(nextOccurrenceAfter(at, { recurrence: "weekly" }, at)).date, "2026-04-04")
  const jan31 = new Date("2026-01-31T08:00:00Z")
  assert.equal(osloParts(nextOccurrenceAfter(jan31, { recurrence: "monthly" }, jan31)).date, "2026-02-28")
  assert.equal(osloParts(nextOccurrenceAfter(jan31, { recurrence: "monthly" }, new Date("2026-03-01T00:00:00Z"))).date, "2026-03-31", "back to the 31st")
  assert.equal(osloParts(nextOccurrenceAfter(at, { recurrence: "custom", customEvery: 3, customUnit: "days" }, at)).date, "2026-03-31")
  assert.equal(nextOccurrenceAfter(at, { recurrence: "none" }, at), null)
  // A long outage skips straight to the next future occurrence (no burst).
  const now = new Date("2026-09-25T12:00:00Z")
  const next = nextOccurrenceAfter(new Date("2024-01-01T08:00:00Z"), { recurrence: "daily" }, now)
  assert.ok(next > now && next - now <= 86400000)
})

test("after firing: one-time stops; recurring moves on; unfinished follow-up; completion stops it", () => {
  const fired = new Date("2026-10-01T07:00:00Z")
  const base = { isCompleted: false, reminder: { enabled: true, at: fired, nextAt: fired, recurrence: "none" } }
  assert.equal(nextAfterFiring(base, fired), null)
  const daily = { ...base, reminder: { ...base.reminder, recurrence: "daily" } }
  assert.equal(nextAfterFiring(daily, fired).toISOString(), "2026-10-02T07:00:00.000Z")
  const followUp = { ...base, reminder: { ...base.reminder, onlyIfUnfinished: true, followUpHours: 24 } }
  assert.equal(nextAfterFiring(followUp, fired).toISOString(), "2026-10-02T07:00:00.000Z")
  assert.equal(nextAfterFiring({ ...followUp, isCompleted: true }, fired), null)
  // Recurring + "if unfinished" stops once done; plain recurring continues.
  assert.equal(nextAfterFiring({ ...daily, isCompleted: true, reminder: { ...daily.reminder, onlyIfUnfinished: true } }, fired), null)
  assert.ok(nextAfterFiring({ ...daily, isCompleted: true }, fired))
  assert.equal(shouldFire({ ...followUp, isCompleted: true }), false)
  assert.equal(shouldFire({ ...base, archived: true }), false)
  assert.equal(shouldFire({ ...base, reminder: { enabled: false } }), false)
  assert.equal(shouldFire(base), true)
  // A to-do's reminder always stops once it's done, even when recurring.
  const todo = { ...daily, kind: "todo" }
  assert.ok(nextAfterFiring(todo, fired))
  assert.equal(nextAfterFiring({ ...todo, isCompleted: true }, fired), null)
  assert.equal(shouldFire({ ...todo, isCompleted: true }), false)
})

test("sharing: private reaches nobody else; each group only its roles", () => {
  for (const role of ["owner", "administrator", "superadmin", "moderator", "customer"]) {
    assert.equal(inAudience("private", role), false, role)
    assert.equal(inAudience(undefined, role), false, role)
  }
  assert.equal(inAudience("owner", "owner"), true)
  assert.equal(inAudience("owner", "administrator"), false)
  assert.equal(inAudience("owner", "superadmin"), false)
  assert.equal(inAudience("administrator", "administrator"), true)
  assert.equal(inAudience("administrator", "superadmin"), true)
  assert.equal(inAudience("administrator", "owner"), false)
  assert.equal(inAudience("everyone", "owner"), true)
  assert.equal(inAudience("everyone", "administrator"), true)
})

test("checklist progress and related links", () => {
  assert.deepEqual(checklistProgress({ checklistItems: [{ completed: true }, { completed: false }] }), { done: 1, total: 2 })
  assert.equal(relatedHref({ type: "invoice", id: "abc" }, "/dashboard/admin"), "/faktura/abc")
  assert.equal(relatedHref({ type: "order", id: "x", ref: "1045" }, "/dashboard/owner"), "/dashboard/owner/ordreoversikt?search=1045")
  assert.equal(relatedHref({ type: "appointment", id: "a1" }, "/dashboard/admin"), "/dashboard/admin/ansattmoter?appointment=a1")
})

test("access: notes permissions by role; never for customers; legacy notes.use still honoured", () => {
  const has = (opts, p) => computeEffectivePermissions(opts).includes(p)
  for (const p of NOTES_PERMISSIONS) {
    assert.ok(has({ role: "owner" }, p), `owner ${p}`)
    assert.ok(has({ role: "administrator" }, p), `administrator ${p}`)
    assert.ok(!has({ role: "customer" }, p), `customer ${p}`)
    assert.ok(!has({ role: "customer", grants: [p] }, p), `customer grant ${p} ignored`)
    assert.equal(isGrantable(p, "customer"), false)
    assert.equal(isGrantable(p, "moderator"), true)
  }
  // Moderators receive shared notes (and may edit them where allowed), but
  // don't write, delete or share notes of their own.
  assert.ok(has({ role: "moderator" }, "notes.view") && has({ role: "moderator" }, "notes.edit"))
  for (const p of ["notes.create", "notes.delete", "notes.share"]) assert.ok(!has({ role: "moderator" }, p), p)
  // An old per-user "notes.use" deny / grant keeps its meaning.
  for (const p of NOTES_PERMISSIONS) assert.ok(!has({ role: "administrator", denies: ["notes.use"] }, p), `legacy deny ${p}`)
  assert.ok(has({ role: "moderator", grants: ["notes.use"] }, "notes.share"), "legacy grant")
})

const viewer = (userId, role, perms = NOTES_PERMISSIONS) => ({ userId, role, can: (p) => perms.includes(p) })
const CREATOR = "a".repeat(24)
const ADMIN = "b".repeat(24)
const MOD = "c".repeat(24)
const OWNER = "d".repeat(24)

test("sharing: private notes reach nobody but the creator", () => {
  const note = { createdBy: CREATOR, visibility: "private" }
  assert.equal(noteAccess(note, viewer(CREATOR, "owner")).mode, "owner")
  for (const [id, role] of [[ADMIN, "administrator"], [MOD, "moderator"], [OWNER, "owner"], [ADMIN, "superadmin"]]) {
    assert.equal(noteAccess(note, viewer(id, role)).canView, false, role)
  }
  // "shared" with nobody in it is private.
  assert.equal(effectiveSharing({ visibility: "shared", sharedRoles: [], sharedUserIds: [] }).visibility, "private")
})

test("sharing: view only vs. editing; only the creator deletes or re-shares", () => {
  const viewOnly = { createdBy: CREATOR, visibility: "shared", sharedRoles: ["administrator"], allowSharedEditing: false }
  const admin = noteAccess(viewOnly, viewer(ADMIN, "administrator"))
  assert.deepEqual([admin.canView, admin.canEdit, admin.canDelete, admin.canShare, admin.mode], [true, false, false, false, "view"])
  const editable = { ...viewOnly, allowSharedEditing: true }
  const adminEdit = noteAccess(editable, viewer(ADMIN, "administrator"))
  assert.deepEqual([adminEdit.canEdit, adminEdit.canDelete, adminEdit.canShare, adminEdit.mode], [true, false, false, "edit"])
  // Editing still needs the notes.edit permission.
  assert.equal(noteAccess(editable, viewer(ADMIN, "administrator", ["notes.view"])).canEdit, false)
  // The Super Admin counts as an administrator; others roles aren't included.
  assert.equal(noteAccess(viewOnly, viewer(ADMIN, "superadmin")).canView, true)
  assert.equal(noteAccess(viewOnly, viewer(MOD, "moderator")).canView, false)
  assert.equal(noteAccess(viewOnly, viewer(OWNER, "owner")).canView, false)
  // The creator keeps full control.
  const me = noteAccess(editable, viewer(CREATOR, "owner"))
  assert.deepEqual([me.canEdit, me.canDelete, me.canShare], [true, true, true])
})

test("sharing: role combinations and individual people", () => {
  const note = { createdBy: CREATOR, visibility: "shared", sharedRoles: ["moderator", "owner"], sharedUserIds: [ADMIN] }
  assert.equal(noteAccess(note, viewer(MOD, "moderator")).canView, true)
  assert.equal(noteAccess(note, viewer(OWNER, "owner")).canView, true)
  assert.equal(noteAccess(note, viewer(ADMIN, "administrator")).canView, true, "shared personally")
  assert.equal(noteAccess(note, viewer("e".repeat(24), "administrator")).canView, false, "other administrators aren't")
  assert.equal(legacyShareValue(effectiveSharing(note)), "custom")
})

test("sharing: legacy one-group notes keep their audience, read-only for others", () => {
  assert.deepEqual(effectiveSharing({ sharedWith: "everyone" }), { visibility: "shared", roles: ["administrator", "owner"], userIds: [], allowEditing: false })
  assert.deepEqual(effectiveSharing({ sharedWith: "owner" }).roles, ["owner"])
  assert.equal(effectiveSharing({}).visibility, "private")
  assert.equal(noteAccess({ createdBy: CREATOR, sharedWith: "administrator" }, viewer(ADMIN, "administrator")).mode, "view")
  for (const v of ["private", "owner", "administrator", "everyone"]) assert.equal(legacyShareValue(effectiveSharing({ sharedWith: v })), v)
})

test("sharing input: validated, normalized, never trusted", () => {
  assert.deepEqual(parseSharing({ roles: ["owner", "administrator"], allowEditing: true }), { visibility: "shared", roles: ["administrator", "owner"], userIds: [], allowEditing: true })
  assert.deepEqual(parseSharing({ visibility: "private", roles: ["owner"], allowEditing: true }), { visibility: "private", roles: [], userIds: [], allowEditing: false })
  assert.deepEqual(parseSharing({ roles: [] }), { visibility: "private", roles: [], userIds: [], allowEditing: false })
  assert.equal(parseSharing({ roles: ["owner"], allowEditing: "yes" }).allowEditing, false, "only a real true enables editing")
  assert.equal(parseSharing(null, "owner").roles[0], "owner", "legacy value")
  assert.throws(() => parseSharing({ roles: ["customer"] }), /Invalid sharing/)
  assert.throws(() => parseSharing({ roles: ["superadmin"] }), /Invalid sharing/)
  assert.throws(() => parseSharing({ userIds: ["not-an-id"] }), /Invalid share recipient/)
  assert.throws(() => parseSharing(null, "moderator"), /Invalid sharing/)
  assert.throws(() => parseSharing("everyone"), /Invalid sharing/)
})

test("ids compare the same whatever their form (ObjectId, populated doc, string)", async () => {
  const { default: mongoose } = await import("mongoose")
  const oid = new mongoose.Types.ObjectId()
  const hex = oid.toHexString()
  assert.ok(sameId(oid, hex) && sameId(hex.toUpperCase(), oid) && sameId({ _id: oid }, hex))
  assert.ok(!sameId(oid, new mongoose.Types.ObjectId()) && !sameId(null, null) && !sameId("", ""))
  // A note shared with an ObjectId is visible to the same user given as a string, and vice versa.
  const note = { createdBy: CREATOR, visibility: "shared", sharedRoles: [], sharedUserIds: [oid] }
  assert.equal(noteAccess(note, viewer(hex, "moderator")).canView, true)
  assert.equal(noteAccess({ ...note, sharedUserIds: [hex] }, viewer(oid, "moderator")).canView, true)
  assert.equal(noteAccess({ ...note, createdBy: oid }, viewer(hex, "owner")).isOwner, true)
  assert.equal(idString({ _id: hex }), hex)
})

test("a stale model with an old schema is replaced, so sharing fields are never dropped", async () => {
  const { default: mongoose } = await import("mongoose")
  const { registerModel } = await import("../lib/models/registerModel.js")
  // What a long-running dev server held: the model registered with an old schema.
  const name = `StaleNote${Date.now()}`
  registerModel(name, new mongoose.Schema({ title: String }))
  const fresh = registerModel(name, new mongoose.Schema({ title: String, visibility: String }))
  const doc = new fresh({ title: "x", visibility: "shared" })
  assert.equal(doc.visibility, "shared")
  // The real Note model knows every field notes write.
  const { Note } = await import("../lib/models/Note.js")
  for (const k of ["visibility", "sharedRoles", "sharedUserIds", "allowSharedEditing", "lastEditedBy", "lastEditedAt"]) {
    assert.notEqual(Note.schema.pathType(k), "adhocOrUndefined", k)
  }
})

test("edits: only real content changes count", () => {
  const before = { title: "A", content: "x", checklistItems: [{ text: "one", completed: false }], isCompleted: false }
  assert.deepEqual(changedContentFields(before, { title: "A", content: "x" }), [])
  assert.deepEqual(changedContentFields(before, { title: "B", content: "x" }), ["title"])
  assert.deepEqual(changedContentFields(before, { checklistItems: [{ text: "one", completed: true }] }), ["checklistItems"])
  assert.deepEqual(changedContentFields(before, { isCompleted: true, sharedRoles: ["owner"] }), ["isCompleted"])
})

test("uploads: type from extension AND content; size limit", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  const pdf = Buffer.from("%PDF-1.7\n...")
  assert.equal(validateUpload(png, "shot.png", "file").mime, "image/png")
  assert.equal(validateUpload(pdf, "quote.PDF", "file").mime, "application/pdf")
  assert.throws(() => validateUpload(Buffer.from("MZ\x90\x00"), "evil.pdf", "file"), /isn't allowed/)
  assert.throws(() => validateUpload(Buffer.from("MZ\x90\x00"), "evil.exe", "file"), /isn't allowed/)
  assert.throws(() => validateUpload(Buffer.from("<svg onload=alert(1)>"), "x.svg", "file"), /isn't allowed/)
  assert.throws(() => validateUpload(Buffer.alloc(11 * 1024 * 1024, 1), "big.txt", "file"), /10 MB/)
  assert.equal(validateUpload(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2]), "voice-note.webm", "voice").mime, "audio/webm")
  assert.throws(() => validateUpload(png, "voice-note.webm", "voice"), /isn't allowed/)
})

test("reminder email: recipient's language, escaped content, related record, link", () => {
  const note = {
    _id: "n1",
    title: "Follow up <b>ABC</b>",
    content: "Call customer regarding matte black packaging",
    checklistItems: [{ text: "Send quote", completed: false }, { text: "Book van", completed: true }],
    relatedEntityType: "order",
    relatedEntityLabel: "#1045 — ABC AS",
  }
  const firedAt = new Date("2026-10-05T07:00:00Z")
  const en = renderReminderEmail(note, { user: { language: "en", timeFormat: "24h" }, firedAt, url: "https://example.test/dashboard/admin/notater?note=n1" })
  assert.equal(en.subject, "Reminder: Follow up <b>ABC</b>")
  assert.ok(en.html.includes("Follow up &lt;b&gt;ABC&lt;/b&gt;") && !en.html.includes("<b>ABC</b>"))
  assert.ok(en.html.includes("Order: #1045 — ABC AS"))
  assert.ok(en.html.includes("Checklist: 1 of 2 done") && en.html.includes("Send quote") && !en.html.includes("Book van"))
  assert.ok(en.html.includes("09:00") && en.html.includes("notater?note=n1"))
  const no = renderReminderEmail(note, { user: { language: "no" }, firedAt })
  assert.match(no.subject, /^Påminnelse:/)
  assert.ok(no.html.includes("Ordre: #1045 — ABC AS"))
  assert.ok(!no.html.includes("Delt av"))
  // Shared: recipients see who shared it; to-dos are labelled as such.
  const shared = renderReminderEmail({ ...note, kind: "todo" }, { user: { language: "en" }, firedAt, url: "https://x.test/t", sharedBy: "Kari <Nordmann>" })
  assert.ok(shared.html.includes("Shared by Kari &lt;Nordmann&gt;") && shared.text.includes("Shared by Kari <Nordmann>"))
  assert.ok(shared.html.includes("TO-DO") && shared.html.includes("Open the to-do"))
})
