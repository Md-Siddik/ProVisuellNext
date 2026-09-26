import mongoose from "mongoose"

// Registers a Mongoose model — and, outside production, replaces a stale one.
//
// Why: `mongoose.models.X || mongoose.model("X", schema)` returns whatever
// was registered first. In `next dev`, a model file edited while the server
// runs is re-evaluated with the new schema, but mongoose itself (in
// node_modules) is not reloaded, so the OLD model — and its old schema —
// kept being used. Mongoose's strict mode then silently drops every field
// the old schema doesn't know on save. That is exactly how note sharing
// (visibility / sharedRoles / sharedUserIds) was being thrown away.
//
// In production each model file is evaluated once per process, so the first
// branch never runs there.
export function registerModel(name, schema) {
  const existing = mongoose.models[name]
  if (existing && existing.schema !== schema && process.env.NODE_ENV !== "production") {
    mongoose.deleteModel(name)
  }
  return mongoose.models[name] || mongoose.model(name, schema)
}
