import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// Who changed a note's text, and from what to what. One entry per editing
// session: consecutive saves by the same person within a few minutes (the
// editor autosaves while typing) update that entry instead of adding one per
// keystroke — see lib/notes/history.js. Readable by anyone who can see the
// note; deleted with it.
const snapshotSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    content: { type: String, default: "" },
    checklistItems: { type: [{ text: String, completed: Boolean, _id: false }], default: undefined },
    isCompleted: { type: Boolean, default: undefined },
  },
  { _id: false }
)

const noteEditHistorySchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    editorName: { type: String, default: "" },
    editorRole: { type: String, default: "" },
    editedAt: { type: Date, required: true },
    // Content fields changed in this session (title, content, checklistItems, isCompleted).
    fields: { type: [String], default: [] },
    previous: { type: snapshotSchema, default: () => ({}) },
    updated: { type: snapshotSchema, default: () => ({}) },
  },
  { versionKey: false }
)

noteEditHistorySchema.index({ note: 1, editedAt: -1 })

export const NoteEditHistory = registerModel("NoteEditHistory", noteEditHistorySchema)
