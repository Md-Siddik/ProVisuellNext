import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { findAccessibleNote } from "@/lib/notes/service"
import { noteHistory } from "@/lib/notes/history"

// Who changed a note and what it said before, newest first. Anyone who can
// see the note can see its history (it shows nothing they can't already
// read); nobody else can tell the note exists.
export const GET = withApiErrors(async (request, { params }) => {
  const auth = requirePermission(await authenticate(request), "notes.view")
  const { id } = await params
  const note = await findAccessibleNote(auth, id, { select: "_id createdBy createdByName createdByRole createdAt" })
  return NextResponse.json({
    createdBy: { name: note.createdByName, role: note.createdByRole, at: note.createdAt },
    entries: await noteHistory(note._id),
  })
})

export const dynamic = "force-dynamic"
