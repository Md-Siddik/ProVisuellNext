// One-off migration for shared Website Editor values (lib/siteContent.js).
//
//   npm run migrate:site-content            dry run — prints what would change
//   npm run migrate:site-content -- --apply backs up the collection, then migrates
//
// What it does (safe to run again — nothing left to do means no changes):
//   • a shared key (contact details, copyright year, company name, stats)
//     edited per language before → one shared row with the newest value;
//     the per-language copies are removed
//   • the old whole-sentence copyright ("© 2026 ProVisuell AS. All rights
//     reserved.") → shared year + company, and each language's own
//     "All rights reserved" text; the old rows are removed once split
// The site shows the same result with or without this migration (the API
// already reads old rows this way); it only makes the stored data match.
import dotenv from "dotenv"
import dns from "node:dns"
import mongoose from "mongoose"
import { LEGACY_COPYRIGHT_KEY, SHARED_TEXT_KEYS, parseLegacyCopyright } from "../lib/siteContent.js"

dotenv.config({ path: ".env.local" })
dns.setServers(["8.8.8.8", "1.1.1.1"])

const apply = process.argv.includes("--apply")
const uri = process.env.MONGO_URI
if (!uri) {
  console.error("MONGO_URI is not set in provisuell_nextjs/.env.local")
  process.exit(1)
}

await mongoose.connect(uri)
const col = mongoose.connection.db.collection("sitecontents")
const now = new Date()
const all = await col.find({}).toArray()
console.log(`${apply ? "APPLY" : "DRY RUN"} — ${all.length} content row(s) in "${mongoose.connection.db.databaseName}"`)

if (apply && all.length) {
  const backupName = `sitecontents_backup_${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}`
  await mongoose.connection.db.collection(backupName).insertMany(all)
  console.log(`Backed up ${all.length} row(s) to "${backupName}"`)
}

const time = (d) => new Date(d.updatedAt || d.createdAt || 0).getTime()
const newestOf = (rows) => rows.reduce((a, b) => (!a || time(b) > time(a) ? b : a), null)
const has = (key, language) => all.some((d) => d.contentKey === key && (d.language ?? null) === language)
let writes = 0
let removals = 0

async function upsertShared(key, value, updatedBy) {
  console.log(`  ${key}: shared value "${value}"`)
  writes++
  if (apply) await col.updateOne({ contentKey: key, language: null }, { $set: { contentKey: key, language: null, type: "text", value, updatedBy: updatedBy || null, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true })
}

async function remove(rows, why) {
  for (const r of rows) console.log(`  remove ${r.contentKey} [${r.language}] "${r.value}" (${why})`)
  removals += rows.length
  if (apply && rows.length) await col.deleteMany({ _id: { $in: rows.map((r) => r._id) } })
}

// Shared keys.
for (const key of SHARED_TEXT_KEYS) {
  const perLanguage = all.filter((d) => d.contentKey === key && d.language)
  if (!perLanguage.length) continue
  if (!has(key, null)) {
    const newest = newestOf(perLanguage)
    await upsertShared(key, newest.value, newest.updatedBy)
  }
  await remove(perLanguage, "now shared")
}

// Legacy copyright sentence.
const legacy = all.filter((d) => d.contentKey === LEGACY_COPYRIGHT_KEY && d.language)
if (legacy.length) {
  const newest = parseLegacyCopyright(newestOf(legacy).value)
  if (newest?.year && !has("footer.copyrightYear", null) && !all.some((d) => d.contentKey === "footer.copyrightYear" && d.language)) {
    await upsertShared("footer.copyrightYear", newest.year, newestOf(legacy).updatedBy)
  }
  if (newest?.company && !has("footer.companyName", null) && !all.some((d) => d.contentKey === "footer.companyName" && d.language)) {
    await upsertShared("footer.companyName", newest.company, newestOf(legacy).updatedBy)
  }
  const split = []
  for (const row of legacy) {
    const parsed = parseLegacyCopyright(row.value)
    if (!parsed?.rights) {
      console.log(`  keep ${LEGACY_COPYRIGHT_KEY} [${row.language}] "${row.value}" — couldn't split it; re-enter it in the Website Editor`)
      continue
    }
    if (!has("footer.rightsReserved", row.language)) {
      console.log(`  footer.rightsReserved [${row.language}]: "${parsed.rights}"`)
      writes++
      if (apply) await col.insertOne({ contentKey: "footer.rightsReserved", language: row.language, type: "text", value: parsed.rights, updatedBy: row.updatedBy || null, createdAt: now, updatedAt: now })
    }
    split.push(row)
  }
  await remove(split, "split into year / company / rights text")
}

console.log(`\n${apply ? "Done" : "Would change"}: ${writes} row(s) written, ${removals} row(s) removed.`)
if (!apply && (writes || removals)) console.log("Run again with --apply to make these changes (a backup is taken first).")
await mongoose.disconnect()
