import dns from "node:dns"
import mongoose from "mongoose"

// Node's built-in DNS resolver can fail SRV lookups (ECONNREFUSED) on
// networks where the OS-configured nameserver doesn't handle them well,
// even though the OS's own resolver handles the same query fine. Pointing
// Node at a public resolver sidesteps that. (Ported as-is from Server/src/db.js.)
dns.setServers(["8.8.8.8", "1.1.1.1"])
// Node 18+ resolves IPv6 first by default, which on some Windows networks
// makes the mongodb+srv driver's periodic topology re-poll fail with
// `querySrv ECONNREFUSED` even though the initial connection succeeded —
// forcing IPv4 first avoids that path entirely.
dns.setDefaultResultOrder("ipv4first")

const uri = process.env.MONGO_URI

// Next.js dev mode reloads route/module code on every request without
// restarting the process, which would otherwise call mongoose.connect()
// repeatedly and exhaust connections. Caching the promise on `global`
// (not just a module-level variable) survives that reload the same way
// the official Next.js+Mongoose pattern does.
let cached = global._mongooseConn
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null }
}

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!uri) throw new Error("MONGO_URI is not set in provisuell_nextjs/.env.local")

  if (!cached.promise) {
    mongoose.set("strictQuery", true)
    cached.promise = mongoose
      .connect(uri)
      .then((m) => {
        console.log("MongoDB connected")
        // Without a listener, a dropped connection or a failed background
        // SRV re-poll surfaces as a raw unhandled error instead of a clean
        // log line — this doesn't change query behavior, only how
        // connection-level errors are reported.
        m.connection.on("error", (err) => console.error("MongoDB connection error:", err.message))
        return m
      })
      .catch((err) => {
        // A failed connection attempt must not poison the cache forever —
        // clear it so the next request can retry instead of every request
        // rejecting on this same stale promise until the process restarts.
        cached.promise = null
        throw err
      })
  }
  cached.conn = await cached.promise
  return cached.conn
}
