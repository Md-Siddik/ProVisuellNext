// One-off migration for the Notes / To-do split and private-by-default notes.
//
//   npm run migrate:notes            dry run — prints what would change
//   npm run migrate:notes -- --apply backs up the notes collection, then migrates
//
// What it does (safe to run again — already-migrated notes are skipped):
//   • every note gets kind "note" and an explicit sharing value (missing →
//     "private"; the app already treats a missing value as private)
//   • sharing moves to the role-list fields (visibility, sharedRoles,
//     sharedUserIds, allowSharedEditing): a note keeps exactly the audience
//     it had, and editing by the people it is shared with starts OFF. The
//     old sharedWith value is left in place (ignored once visibility exists)
//   • the old creator pin (isPinned) becomes a per-user pin (pinnedBy)
//   • each checklist note becomes one to-do per item (same creator, sharing,
//     linked record and done state); the first unfinished to-do takes over the
//     note's reminder. The original note is archived (reason "converted"),
//     never deleted, so it can still be opened from the Notes archive.
// The app works with or without this migration; it only makes old data
// match the new layout.
import dotenv from "dotenv"
import dns from "node:dns"
import mongoose from "mongoose"
import { Note } from "../lib/models/Note.js"
import { buildSearchTokens, effectiveSharing, LIMITS, SHARE_OPTIONS } from "../lib/notes/core.js"

dotenv.config({ path: ".env.local" })
dns.setServers(["8.8.8.8", "1.1.1.1"])

const apply = process.argv.includes("--apply")
const uri = process.env.MONGO_URI
if (!uri) {
  console.error("MONGO_URI is not set in provisuell_nextjs/.env.local")
  process.exit(1)
}

await mongoose.connect(uri)
const notes = mongoose.connection.db.collection("notes")
const all = await notes.find({}).toArray()
const now = new Date()
console.log(`${apply ? "APPLY" : "DRY RUN"} — ${all.length} note(s) in "${mongoose.connection.db.databaseName}"`)

if (apply && all.length) {
  const backupName = `notes_backup_${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}`
  await mongoose.connection.db.collection(backupName).insertMany(all)
  console.log(`Backed up ${all.length} note(s) to "${backupName}"`)
}

let fieldUpdates = 0
let converted = 0
let todosCreated = 0

for (const note of all) {
  const set = {}
  if (!note.kind) set.kind = "note"
  if (!SHARE_OPTIONS.includes(note.sharedWith)) set.sharedWith = "private"
  if (!note.visibility) {
    const sharing = effectiveSharing({ sharedWith: set.sharedWith || note.sharedWith })
    Object.assign(set, { visibility: sharing.visibility, sharedRoles: sharing.roles, sharedUserIds: [], allowSharedEditing: false })
  }
  if (note.isPinned && !(note.pinnedBy || []).some((id) => String(id) === String(note.createdBy))) {
    set.pinnedBy = [...(note.pinnedBy || []), note.createdBy]
  }

  const items = (note.checklistItems || []).filter((i) => String(i?.text || "").trim())
  const convert = (note.kind || "note") === "note" && note.type === "checklist" && items.length > 0 && !note.convertedAt
  if (convert) {
    const already = await notes.countDocuments({ convertedFrom: note._id })
    if (!already) {
      const firstOpen = items.findIndex((i) => !i.completed)
      const todos = items.map((item, index) => {
        const inheritsReminder = index === firstOpen && note.reminder?.enabled
        const doc = new Note({
          kind: "todo",
          type: "text",
          title: String(item.text).trim().slice(0, LIMITS.title),
          content: "",
          tags: note.tags || [],
          relatedEntityType: note.relatedEntityType || null,
          relatedEntityId: note.relatedEntityId || null,
          relatedEntityLabel: note.relatedEntityLabel || "",
          relatedEntityRef: note.relatedEntityRef || "",
          createdBy: note.createdBy,
          createdByName: note.createdByName,
          createdByRole: note.createdByRole,
          updatedBy: note.updatedBy || note.createdBy,
          sharedWith: set.sharedWith || note.sharedWith || "private",
          visibility: set.visibility || note.visibility,
          sharedRoles: set.sharedRoles || note.sharedRoles || [],
          sharedUserIds: note.sharedUserIds || [],
          allowSharedEditing: Boolean(note.allowSharedEditing),
          isCompleted: Boolean(item.completed),
          completedAt: item.completed ? note.completedAt || note.updatedAt || now : null,
          convertedFrom: note._id,
          ...(inheritsReminder ? { reminder: note.reminder } : {}),
        }).toObject()
        doc.searchTokens = buildSearchTokens(doc)
        doc.createdAt = note.createdAt || now
        doc.updatedAt = now
        return doc
      })
      console.log(`  checklist "${note.title || "(untitled)"}" (${note._id}) → ${todos.length} to-do(s)${firstOpen >= 0 && note.reminder?.enabled ? ", reminder moves to the first open one" : ""}`)
      if (apply) await notes.insertMany(todos)
      todosCreated += todos.length
    }
    Object.assign(set, {
      archived: true,
      archivedAt: note.archivedAt || now,
      archiveReason: "converted",
      convertedAt: now,
      "reminder.nextAt": null,
      "reminder.enabled": false,
    })
    converted++
  }

  if (Object.keys(set).length) {
    fieldUpdates++
    if (!convert) console.log(`  note ${note._id}: ${Object.keys(set).join(", ")}`)
    if (apply) await notes.updateOne({ _id: note._id }, { $set: set })
  }
}

console.log(`\n${apply ? "Done" : "Would change"}: ${fieldUpdates} note(s) updated, ${converted} checklist(s) converted, ${todosCreated} to-do(s) created.`)
if (!apply && (fieldUpdates || todosCreated)) console.log("Run again with --apply to make these changes (a backup is taken first).")
await mongoose.disconnect()
