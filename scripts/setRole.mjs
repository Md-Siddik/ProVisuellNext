// One-off CLI to promote a user to owner/administrator, since there's no
// self-serve way to become one. The user must have logged in at least once
// already (so their Mongo User document exists).
//
// Usage: npm run set-role -- you@email.com owner
import dotenv from "dotenv"
import dns from "node:dns"
import mongoose from "mongoose"
import { User } from "../lib/models/User.js"

// Next.js itself auto-loads .env.local at runtime; this standalone script
// runs outside that runtime, so it has to load the same file explicitly.
dotenv.config({ path: ".env.local" })

dns.setServers(["8.8.8.8", "1.1.1.1"])

const [, , email, role] = process.argv

if (!email || !role) {
  console.error("Usage: npm run set-role -- <email> <owner|administrator|moderator|customer>")
  process.exit(1)
}
if (!["owner", "administrator", "moderator", "customer"].includes(role)) {
  console.error("role must be one of: owner, administrator, moderator, customer")
  process.exit(1)
}

const uri = process.env.MONGO_URI
if (!uri) {
  console.error("MONGO_URI is not set in provisuell_nextjs/.env.local")
  process.exit(1)
}

await mongoose.connect(uri)

const user = await User.findOneAndUpdate({ email }, { role }, { new: true })

if (!user) {
  console.error(
    `No user found with email "${email}". They need to log in at least once on the site first (this creates their account), then re-run this script.`
  )
  process.exit(1)
}

console.log(`OK — ${user.email} is now "${user.role}".`)
await mongoose.disconnect()
