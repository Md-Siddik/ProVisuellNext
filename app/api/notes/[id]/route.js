import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { effectiveSharing } from "@/lib/notes/core"
import {
  applyNoteEdit,
  assertCanDelete,
  buildNoteFields,
  findAccessibleNote,
  isNoteOwner,
  pruneNoteNotifications,
  removeNotes,
  serializeNote,
  shareRecipientNames,
} from "@/lib/notes/service"

// One note or to-do. Only reachable by its creator or the people it's shared
// with (anyone else gets 404, exactly like a note that doesn't exist).
// PATCH: the creator may change anything their permissions allow; people it's
// shared with may edit the text and tick it done only when the creator
// allowed editing. Pinning is personal to whoever pins.

async function respond(auth, note) {
  const recipients = isNoteOwner(auth, note) ? await shareRecipientNames([note]) : null
  return NextResponse.json({ note: serializeNote(note, auth, recipients) })
}

export const GET = withApiErrors(async (request, { params }) => {
  const auth = requirePermission(await authenticate(request), "notes.view")
  const { id } = await params
  return respond(auth, await findAccessibleNote(auth, id))
})

export const PATCH = withApiErrors(async (request, { params }) => {
  const auth = requirePermission(await authenticate(request), "notes.view")
  const { id } = await params
  const note = await findAccessibleNote(auth, id)
  const body = (await request.json().catch(() => ({}))) || {}
  // The linked record is fixed at creation; the creator never changes.
  delete body.relatedEntityType
  delete body.relatedEntityId
  delete body.createdBy

  if (Object.prototype.hasOwnProperty.call(body, "isPinned")) {
    const me = auth.user._id
    const others = (note.pinnedBy || []).filter((x) => String(x) !== String(me))
    note.pinnedBy = body.isPinned ? [...others, me] : others
    // Retire the legacy creator pin once the creator unpins.
    if (!body.isPinned && isNoteOwner(auth, note)) note.isPinned = false
    delete body.isPinned
  }

  const previousSharing = JSON.stringify(effectiveSharing(note))
  if (Object.keys(body).length) await applyNoteEdit(auth, note, await buildNoteFields(auth, body, note))
  else await note.save()

  // Narrowed or removed sharing: people who lost access lose its notifications too.
  if (JSON.stringify(effectiveSharing(note)) !== previousSharing) await pruneNoteNotifications(note)
  return respond(auth, note)
})

export const DELETE = withApiErrors(async (request, { params }) => {
  const auth = requirePermission(await authenticate(request), "notes.view")
  const { id } = await params
  const note = await findAccessibleNote(auth, id)
  assertCanDelete(auth, note)
  await removeNotes([note])
  return new Response(null, { status: 204 })
})
