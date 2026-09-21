const MESSAGES_KEY = "provisuell_chat_messages"
const VISITOR_KEY = "provisuell_visitor_id"
const USER_KEY = "provisuell_user"

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    try {
      localStorage.setItem(VISITOR_KEY, id)
    } catch {
      // storage unavailable — keep the in-memory id for this session only
    }
  }
  return id
}

// Anonymous chat history lives in localStorage and is never pruned or expired.
// Once the login system exists, swap this module's guts for an API-backed
// version keyed by the authenticated user instead of the local visitor id —
// every call site here (ChatWidget) stays the same.
function loadMessages() {
  return safeParse(localStorage.getItem(MESSAGES_KEY), [])
}

function saveMessages(messages) {
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages))
  } catch {
    // quota exceeded / private mode — the thread still works for this session
  }
}

// Placeholder auth read: a future login flow should write the signed-in
// user to this same key so isAuthenticated() starts returning true with
// no changes needed here.
function getCurrentUser() {
  return safeParse(localStorage.getItem(USER_KEY), null)
}

function isAuthenticated() {
  return Boolean(getCurrentUser())
}

export const chatStorage = {
  getVisitorId,
  loadMessages,
  saveMessages,
  getCurrentUser,
  isAuthenticated,
}
