// An error a Route Handler throws to answer with a specific HTTP status —
// caught and turned into JSON by withApiErrors (lib/auth.js). `code` is an
// optional machine-readable reason (e.g. "SLOT_UNAVAILABLE") for clients
// that need to branch on it rather than on the message text.
export class ApiError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    if (code) this.code = code
  }
}
