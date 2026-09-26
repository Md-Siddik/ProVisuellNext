// Runs once when the Next.js server starts. The Node-only import sits inside
// the NEXT_RUNTIME check so it's left out of the edge bundle entirely.
// Note reminders: see lib/notes/ticker.js.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNotesReminderTicker } = await import("./lib/notes/ticker.js")
    startNotesReminderTicker()
  }
}
