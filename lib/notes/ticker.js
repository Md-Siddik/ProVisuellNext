import { processDueReminders } from "./service.js"

// The in-process reminder ticker (started from instrumentation.js on a normal
// `next start` / `next dev` server). All reminder state lives in MongoDB, so
// a restart loses nothing, and the processor's compare-and-swap means several
// servers — or this ticker plus the /api/notes/reminders/run cron route —
// never send the same reminder twice. Disable with NOTES_REMINDER_TICKER=off
// on serverless hosts and call the cron route on a schedule instead.
export function startNotesReminderTicker() {
  if (process.env.NOTES_REMINDER_TICKER === "off" || process.env.VERCEL) return
  if (globalThis.__notesReminderTicker) return // dev hot reload: keep one

  const intervalMs = Math.max(15, Number(process.env.NOTES_REMINDER_INTERVAL_SECONDS) || 60) * 1000
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const result = await processDueReminders(new Date())
      if (result.sent.length || result.archived) {
        console.log(`[notes] reminders sent: ${result.sent.length}, notes archived (expired): ${result.archived}`)
      }
    } catch (err) {
      console.error("[notes] reminder run failed:", err.message)
    } finally {
      running = false
    }
  }
  globalThis.__notesReminderTicker = setInterval(tick, intervalMs)
  globalThis.__notesReminderTicker.unref?.()
  setTimeout(tick, 5000).unref?.()
}
