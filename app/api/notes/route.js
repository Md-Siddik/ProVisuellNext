import { NextResponse } from "next/server"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { Note } from "@/lib/models/Note"
import { RELATED_TYPES, searchTerms } from "@/lib/notes/core"
import {
  accessFilter,
  applySearchTokens,
  archiveExpired,
  assertKnownNoteFields,
  audienceCounts,
  buildNoteFields,
  serializeNote,
  shareRecipientNames,
  sharedByMeFilter,
} from "@/lib/notes/service"

// Notes and to-dos ("notes.view" to open them at all, "notes.create" to
// write new ones). Private by default — every query is limited to the
// caller's own notes plus notes explicitly shared with their role or with
// them personally (lib/notes/service.js).
//
// GET  ?kind=note|todo &filter=all|pinned|shared|mine|sharedWithMe|archived &q=
//      &relatedType=&relatedId= &page=&limit= &countOnly=1 &withMeta=1
//        mine          the caller's own notes (private or shared by them)
//        sharedWithMe  notes other people shared with the caller
//        shared        both of the above that are shared
// POST { kind, title, content, sharing: { visibility, roles, userIds, allowEditing },
//        dueDate, reminder, relatedEntityType, relatedEntityId, ... }
const FILTERS = ["all", "pinned", "shared", "mine", "sharedWithMe", "archived"]

export const GET = withApiErrors(async (request) => {
  const auth = requirePermission(await authenticate(request), "notes.view")
  await archiveExpired()

  const sp = new URL(request.url).searchParams
  const kind = sp.get("kind") === "todo" ? "todo" : "note"
  const filter = FILTERS.includes(sp.get("filter")) ? sp.get("filter") : "all"
  const terms = searchTerms((sp.get("q") || "").slice(0, 200))
  const page = Math.max(1, Math.min(500, Number(sp.get("page")) || 1))
  const maxLimit = kind === "todo" ? 300 : 50
  const limit = Math.max(1, Math.min(maxLimit, Number(sp.get("limit")) || (kind === "todo" ? 300 : 30)))
  const me = auth.user._id
  const pinnedByMe = { $or: [{ pinnedBy: me }, { isPinned: true, createdBy: me }] }

  const and = [accessFilter(auth), kind === "todo" ? { kind: "todo" } : { kind: { $ne: "todo" } }]
  and.push({ archived: filter === "archived" })
  if (filter === "pinned") and.push(pinnedByMe)
  if (filter === "mine") and.push({ createdBy: me })
  if (filter === "sharedWithMe") and.push({ createdBy: { $ne: me } })
  if (filter === "shared") and.push({ $or: [{ createdBy: { $ne: me } }, sharedByMeFilter(auth)] })
  if (terms.length) and.push({ searchTokens: { $all: terms } })
  const relatedType = sp.get("relatedType")
  if (relatedType) {
    if (!RELATED_TYPES.includes(relatedType)) throw new ApiError(400, "Invalid related record")
    and.push({ relatedEntityType: relatedType })
    if (sp.get("relatedId")) and.push({ relatedEntityId: String(sp.get("relatedId")).slice(0, 100) })
  }
  const query = { $and: and }
  if (sp.get("countOnly")) {
    const [total, audience] = await Promise.all([Note.countDocuments(query), sp.get("withMeta") ? audienceCounts(auth) : null])
    return NextResponse.json({ total, ...(audience ? { audience } : {}) })
  }

  // Notes: on the plain "All" view the viewer's pinned notes come separately, on top.
  const splitPinned = kind === "note" && filter === "all" && !terms.length && !relatedType && page === 1
  const listQuery = splitPinned ? { $and: [...and, { $nor: [pinnedByMe] }] } : query
  const [notes, total, pinned, counts] = await Promise.all([
    Note.find(listQuery).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Note.countDocuments(listQuery),
    splitPinned ? Note.find({ $and: [...and, pinnedByMe] }).sort({ updatedAt: -1 }).limit(50).lean() : null,
    sp.get("withMeta") ? audienceCounts(auth) : null,
  ])
  const recipients = await shareRecipientNames([...notes, ...(pinned || [])].filter((n) => String(n.createdBy) === String(me)))
  return NextResponse.json({
    notes: notes.map((n) => serializeNote(n, auth, recipients)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    ...(pinned ? { pinned: pinned.map((n) => serializeNote(n, auth, recipients)) } : {}),
    ...(counts ? { audience: counts } : {}),
  })
})

export const POST = withApiErrors(async (request) => {
  const auth = requirePermission(await authenticate(request), "notes.view", "notes.create")
  const body = (await request.json().catch(() => ({}))) || {}
  const wantsPin = Boolean(body.isPinned)
  delete body.isPinned
  // The creator is always the caller — never taken from the body.
  delete body.createdBy
  const fields = await buildNoteFields(auth, body)
  assertKnownNoteFields(fields)
  const note = new Note({
    ...fields,
    pinnedBy: wantsPin ? [auth.user._id] : [],
    createdBy: auth.user._id,
    createdByName: auth.user.name || auth.user.email,
    createdByRole: auth.access.role,
    updatedBy: auth.user._id,
  })
  applySearchTokens(note)
  await note.save()
  const recipients = await shareRecipientNames([note])
  return NextResponse.json({ note: serializeNote(note, auth, recipients) }, { status: 201 })
})

export const dynamic = "force-dynamic"
