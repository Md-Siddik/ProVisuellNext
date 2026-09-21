import { Counter } from "./models/Counter.js"

// Atomically returns the next number in a named, per-year sequence (e.g.
// "order-2026" -> 8, 9, 10...). Safe under concurrent requests and immune
// to gaps left by deleted documents, unlike counting existing documents.
export async function nextInSequence(key) {
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  )
  return counter.seq
}
