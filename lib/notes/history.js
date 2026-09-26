import { NoteEditHistory } from "../models/NoteEditHistory.js"
import { CONTENT_FIELDS } from "./core.js"

// Edit history for notes. The editor autosaves while typing, so saves by the
// same person within SESSION_MS of their previous one extend that entry
// (its "updated" snapshot moves forward, "previous" stays where the session
// began) instead of adding an entry per keystroke.
const SESSION_MS = 10 * 60 * 1000
const MAX_ENTRIES = 50

export function contentSnapshot(note) {
  const n = typeof note?.toObject === "function" ? note.toObject() : note || {}
  return {
    title: n.title || "",
    content: n.content || "",
    checklistItems: (n.checklistItems || []).map((i) => ({ text: String(i.text), completed: Boolean(i.completed) })),
    isCompleted: Boolean(n.isCompleted),
  }
}

// `fields`: the content fields this save changed (core.js changedContentFields).
export async function recordNoteEdit({ noteId, editor, previous, updated, fields, at = new Date() }) {
  if (!fields.length) return
  const last = await NoteEditHistory.findOne({ note: noteId }).sort({ editedAt: -1 })
  if (last && String(last.editedBy) === String(editor.id) && at - last.editedAt < SESSION_MS) {
    last.updated = updated
    last.fields = CONTENT_FIELDS.filter((f) => last.fields.includes(f) || fields.includes(f))
    last.editedAt = at
    await last.save()
    return
  }
  await NoteEditHistory.create({ note: noteId, editedBy: editor.id, editorName: editor.name, editorRole: editor.role, editedAt: at, fields, previous, updated })
}

export async function noteHistory(noteId, { limit = MAX_ENTRIES } = {}) {
  const entries = await NoteEditHistory.find({ note: noteId }).sort({ editedAt: -1 }).limit(Math.min(limit, MAX_ENTRIES)).lean()
  return entries.map((e) => ({
    _id: e._id,
    editor: { name: e.editorName, role: e.editorRole },
    editedAt: e.editedAt,
    fields: e.fields || [],
    previous: e.previous || {},
    updated: e.updated || {},
  }))
}

export function deleteNoteHistory(noteIds) {
  return NoteEditHistory.deleteMany({ note: { $in: noteIds } })
}
