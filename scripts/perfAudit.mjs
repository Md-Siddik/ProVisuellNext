// Read-only performance probe: query plans and payload sizes for the hot
// endpoints (dashboard polling, customer pages). Writes nothing.
//   node scripts/perfAudit.mjs
import dotenv from "dotenv"
import dns from "node:dns"
import mongoose from "mongoose"

dotenv.config({ path: ".env.local" })
dns.setServers(["8.8.8.8", "1.1.1.1"])
await mongoose.connect(process.env.MONGO_URI)
const db = mongoose.connection.db

async function plan(name, coll, filter, { sort, projection, limit } = {}) {
  let cursor = db.collection(coll).find(filter, projection ? { projection } : {})
  if (sort) cursor = cursor.sort(sort)
  if (limit) cursor = cursor.limit(limit)
  const e = await cursor.explain("executionStats")
  const s = e.executionStats
  const stage = JSON.stringify(e.queryPlanner.winningPlan).match(/"stage":"(IXSCAN|COLLSCAN)"/)?.[1] || "?"
  console.log(`${name.padEnd(42)} ${stage.padEnd(8)} examined ${String(s.totalDocsExamined).padStart(5)} → returned ${String(s.nReturned).padStart(4)}  ${s.executionTimeMillis} ms`)
}

async function bytes(name, coll, filter, projection) {
  const docs = await db.collection(coll).find(filter, projection ? { projection } : {}).toArray()
  const kb = (Buffer.byteLength(JSON.stringify(docs)) / 1024).toFixed(1)
  console.log(`${name.padEnd(42)} ${String(docs.length).padStart(4)} docs  ${kb.padStart(8)} KB`)
}

const counts = {}
for (const c of ["users", "orders", "invoices", "conversations", "notifications", "appointments", "contactemails", "blogposts"]) {
  counts[c] = await db.collection(c).estimatedDocumentCount()
}
console.log("collection sizes:", counts)

const anyUser = await db.collection("users").findOne({ role: "customer" }, { projection: { _id: 1 } })
const uid = anyUser?._id

console.log("\n-- query plans --")
await plan("orders: customer's own list", "orders", { customerId: uid }, { sort: { createdAt: -1 }, limit: 10 })
await plan("orders: unseen-count (customer)", "orders", { customerId: uid, status: { $in: ["approved", "rejected", "completed"] }, customerSeenAt: null })
await plan("orders: staff list page 1", "orders", {}, { sort: { createdAt: -1 }, limit: 10 })
await plan("orders: by appointmentId", "orders", { appointmentId: { $in: [new mongoose.Types.ObjectId()] } })
await plan("conversations: inbox (sorted)", "conversations", {}, { sort: { lastMessageAt: -1 } })
await plan("notifications: unread-count", "notifications", { user: uid, read: false })
await plan("notifications: list", "notifications", { user: uid }, { sort: { createdAt: -1 }, limit: 20 })
await plan("contactemails: inbox", "contactemails", {}, { sort: { createdAt: -1 } })
await plan("appointments: week range", "appointments", { start: { $gte: new Date(Date.now() - 7 * 864e5), $lte: new Date() } }, { sort: { start: 1 } })
await plan("appointments: customer's own", "appointments", { requestedBy: uid, status: { $ne: "completed" } }, { sort: { start: 1 } })

console.log("\n-- payload per poll --")
await bytes("GET /messages (full, every 8 s)", "conversations", {})
await bytes("GET /messages (list fields only)", "conversations", {}, { messages: 0, typing: 0 })
await bytes("GET /contact-emails (every 8 s)", "contactemails", {})

await mongoose.disconnect()
