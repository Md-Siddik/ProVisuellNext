import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { deletePrivateFile, readPrivateFile } from "@/lib/privateStorage"
import { servingHeaders } from "@/lib/notes/files"
import { assertCanEdit, findAccessibleNote, isNoteOwner, serializeNote } from "@/lib/notes/service"

// A note's attachment or voice note ("voice" as fileId), streamed only to
// people who can see the note. Storage paths never leave the server.
async function locate(auth, params) {
  const { id, fileId } = await params
  const note = await findAccessibleNote(auth, id)
  const file = fileId === "voice" ? note.voiceNote : mongoose.isValidObjectId(fileId) ? note.attachments.id(fileId) : null
  if (!file) throw new ApiError(404, "Not found")
  return { note, file, fileId }
}

export const GET = withApiErrors(async (request, { params }) => {
  const auth = requirePermission(await authenticate(request), "notes.view")
  const { file } = await locate(auth, params)
  const data = await readPrivateFile("notes", file.storedName).catch(() => null)
  if (!data) throw new ApiError(404, "Not found")
  return new Response(data, { headers: { ...servingHeaders(file), "Content-Length": String(data.length) } })
})

export const DELETE = withApiErrors(async (request, { params }) => {
  const auth = requirePermission(await authenticate(request), "notes.view")
  const { note, file, fileId } = await locate(auth, params)
  if (!isNoteOwner(auth, note)) throw new ApiError(403, "Only the note's creator can change this")
  assertCanEdit(auth, note)
  const storedName = file.storedName
  if (fileId === "voice") note.voiceNote = null
  else note.attachments.pull(file._id)
  note.updatedBy = auth.user._id
  await note.save()
  await deletePrivateFile("notes", storedName).catch(() => {})
  return NextResponse.json({ note: serializeNote(note, auth) })
})
