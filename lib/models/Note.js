import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// Internal staff notes (the notes.* permissions — never customers). Never
// part of any customer-facing response.
// Logic that isn't storage lives in lib/notes/core.js and lib/notes/service.js.

const checklistItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
  },
  { _id: true }
)

// Files live in private storage (never under /public) and are only served
// through the authenticated notes API; `storedName` never leaves the server.
const fileSchema = new mongoose.Schema(
  {
    storedName: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ["file", "voice"], default: "file" },
    durationSec: { type: Number, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

const noteSchema = new mongoose.Schema(
  {
    // "note" (written note) or "todo" (a single task). Older documents have
    // no kind and are notes.
    kind: { type: String, enum: ["note", "todo"], default: "note" },
    type: { type: String, enum: ["text", "checklist"], default: "text" },
    // To-dos: optional due day (Europe/Oslo calendar date "YYYY-MM-DD").
    dueDate: { type: String, default: null },
    title: { type: String, default: "" },
    content: { type: String, default: "" },
    checklistItems: { type: [checklistItemSchema], default: [] },
    tags: { type: [String], default: [] },

    // The record this note was written from (optional).
    relatedEntityType: { type: String, default: null }, // order | appointment | invoice | expense | customer | report
    relatedEntityId: { type: String, default: null }, // record id (or "YYYY-MM" for a report month)
    relatedEntityLabel: { type: String, default: "" }, // e.g. "Ordre #1045", "Møte med ABC AS"
    relatedEntityRef: { type: String, default: "" }, // short lookup value, e.g. the order number

    // The owner of the note. Never changes, sharing or not.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Who else may see it (lib/notes/core.js effectiveSharing). Private by
    // default. `visibility` has no schema default on purpose: its absence
    // marks a note saved before role lists, whose audience is still the
    // legacy `sharedWith` group.
    visibility: { type: String, enum: ["private", "shared"] },
    sharedRoles: { type: [{ type: String, enum: ["administrator", "moderator", "owner"] }], default: undefined },
    sharedUserIds: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: undefined },
    // Off = people it's shared with may only read it.
    allowSharedEditing: { type: Boolean, default: false },
    // Legacy single-group sharing (notes saved before `visibility`).
    sharedWith: { type: String, enum: ["private", "owner", "administrator", "everyone"], default: "private" },
    createdByName: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // The last change to the note's text / checklist / done state, by anyone
    // (creator included). Kept apart from the creator, which never changes.
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastEditedByName: { type: String, default: "" },
    lastEditedByRole: { type: String, default: "" },
    lastEditedAt: { type: Date, default: null },

    // Pinning is personal: each viewer pins for themselves.
    pinnedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    isPinned: { type: Boolean, default: false }, // legacy (creator's pin), migrated into pinnedBy
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archiveReason: { type: String, enum: ["manual", "expired", "converted", null], default: null },
    // Migration bookkeeping: a checklist note split into to-dos.
    convertedAt: { type: Date, default: null },
    convertedFrom: { type: mongoose.Schema.Types.ObjectId, default: null },
    expiresAt: { type: Date, default: null },

    // All reminder state is stored here, so it survives restarts and any
    // number of processors can run safely (see lib/notes/service.js).
    reminder: {
      enabled: { type: Boolean, default: false },
      at: { type: Date, default: null }, // first reminder time chosen by the user
      email: { type: Boolean, default: false },
      recurrence: { type: String, enum: ["none", "daily", "weekly", "monthly", "custom"], default: "none" },
      customEvery: { type: Number, default: 1 },
      customUnit: { type: String, enum: ["days", "weeks", "months"], default: "days" },
      onlyIfUnfinished: { type: Boolean, default: false },
      followUpHours: { type: Number, default: 24 },
      recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      nextAt: { type: Date, default: null }, // null = nothing scheduled
      lastSentAt: { type: Date, default: null },
      sentCount: { type: Number, default: 0 },
      lastError: { type: String, default: "" },
    },

    attachments: { type: [fileSchema], default: [] },
    voiceNote: { type: fileSchema, default: null },

    // Accent-folded word prefixes for search (lib/notes/core.js buildSearchTokens).
    searchTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true }
)

// "My notes / to-dos" and "shared with my group" lists, newest first.
noteSchema.index({ createdBy: 1, kind: 1, archived: 1, updatedAt: -1 })
noteSchema.index({ sharedWith: 1, kind: 1, archived: 1, updatedAt: -1 })
noteSchema.index({ sharedRoles: 1, kind: 1, archived: 1, updatedAt: -1 })
noteSchema.index({ sharedUserIds: 1, kind: 1, archived: 1, updatedAt: -1 })
// Search: every term must be one of these prefixes.
noteSchema.index({ searchTokens: 1 })
// "Notes for this record" and the related-type filter.
noteSchema.index({ relatedEntityType: 1, relatedEntityId: 1 })
// The reminder processor's due query.
noteSchema.index({ "reminder.nextAt": 1 }, { partialFilterExpression: { "reminder.nextAt": { $type: "date" } } })
// The expiry sweep.
noteSchema.index({ expiresAt: 1 }, { partialFilterExpression: { expiresAt: { $type: "date" } } })

export const Note = registerModel("Note", noteSchema)
