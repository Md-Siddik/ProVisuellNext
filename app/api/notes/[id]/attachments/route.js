import { NextResponse } from "next/server"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { deletePrivateFile, savePrivateFile } from "@/lib/privateStorage"
import { LIMITS } from "@/lib/notes/core"
import { validateUpload, voiceExtensionFor } from "@/lib/notes/files"
import { assertCanEdit, findAccessibleNote, isNoteOwner, serializeNote } from "@/lib/notes/service"

// Add a file (image / PDF / document) or the voice note to a note (creator only).
// multipart form: file=<File>, kind="file" | "voice", durationSec (voice)
export const POST = withApiErrors(async (request, { params }) => {
  const auth = requirePermission(await authenticate(request), "notes.view")
  const { id } = await params
  const note = await findAccessibleNote(auth, id)
  if (!isNoteOwner(auth, note)) throw new ApiError(403, "Only the note's creator can change this")
  assertCanEdit(auth, note)

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!file || typeof file.arrayBuffer !== "function") throw new ApiError(400, "No file was uploaded")
  const kind = form.get("kind") === "voice" ? "voice" : "file"
  if (kind === "file" && note.attachments.length >= LIMITS.attachments) throw new ApiError(400, "Too many attachments")

  const buffer = Buffer.from(await file.arrayBuffer())
  // Voice recordings arrive as a Blob; name them from their real type.
  const fileName = kind === "voice" ? `voice-note.${voiceExtensionFor(file.type) || "webm"}` : String(file.name || "file").slice(0, 150)
  const { ext, mime } = validateUpload(buffer, fileName, kind)
  const storedName = await savePrivateFile("notes", buffer, ext)
  const entry = {
    storedName,
    fileName,
    mimeType: mime,
    size: buffer.length,
    kind,
    durationSec: kind === "voice" ? Math.max(0, Math.min(3600, Math.round(Number(form.get("durationSec")) || 0))) : null,
    uploadedBy: auth.user._id,
    uploadedAt: new Date(),
  }

  if (kind === "voice") {
    const previous = note.voiceNote?.storedName
    note.voiceNote = entry
    if (previous) await deletePrivateFile("notes", previous).catch(() => {})
  } else {
    note.attachments.push(entry)
  }
  note.updatedBy = auth.user._id
  await note.save()
  return NextResponse.json({ note: serializeNote(note, auth) }, { status: 201 })
})
