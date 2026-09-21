// Maps the exact raw `error` strings the backend returns to an i18n key
// under `apiErrors.*` (see locales/no.js and locales/en.js), so every
// existing `catch (err) { setError(err.message) }` across the app shows
// localized text instead of the server's raw string, with no changes needed
// at each call site — lib/api.js runs every failed request through this
// before throwing.
//
// A standalone lookup (not the useTranslation hook) — this runs outside
// React, and importing src/i18n/index.jsx here would create a circular
// import (that file already imports lib/api.js).
import { no } from "./locales/no"
import { en } from "./locales/en"
import { sv } from "./locales/sv"
import { fi } from "./locales/fi"
import { da } from "./locales/da"

const DICTS = { no, en, sv, fi, da }
const STORAGE_KEY = "provisuell_language"

function getCurrentLanguage() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return DICTS[v] ? v : "no"
  } catch {
    return "no"
  }
}

// Shared with lib/firebaseAuth.js's friendlyAuthError() — same reasoning:
// that's a plain module too, so it can't use the useTranslation() hook.
export function getCurrentLanguageDict() {
  return DICTS[getCurrentLanguage()] || no
}

// Exact backend message -> apiErrors.* key. Unmapped messages (unexpected
// errors, network failures) pass through unchanged rather than disappearing.
const MESSAGE_TO_KEY = {
  "Missing bearer token": "missingBearerToken",
  "Invalid or expired token": "invalidOrExpiredToken",
  "Not allowed for your role": "notAllowedForRole",
  "name, email and message are required": "nameEmailMessageRequired",
  "A valid email address is required": "validEmailRequired",
  "date is required as YYYY-MM-DD": "dateRequiredFormat",
  "title, start and end are required": "titleStartEndRequired",
  "Appointment not found": "appointmentNotFound",
  "Order not found": "orderNotFound",
  "Not your order": "notYourOrder",
  "customerName, customerEmail, service and specification are required": "customerOrderFieldsRequired",
  "status must be 'approved', 'rejected' or 'completed'": "invalidOrderStatus",
  "amount, category and date are required": "amountCategoryDateRequired",
  "value is required": "valueRequired",
  "No file uploaded": "noFileUploaded",
  "Only a customer can share their own order's location": "onlyCustomerShareLocation",
  "A valid lat/lng is required": "validLatLngRequired",
  "That doesn't look like a Google Maps link": "notGoogleMapsLink",
  "Only a customer can list their own locations": "onlyCustomerListLocations",
  "invoiceIds is required": "invoiceIdsRequired",
  "No matching invoices found": "noMatchingInvoices",
  "Invoice not found": "invoiceNotFound",
  "orderId is required": "orderIdRequired",
  "Only completed orders can be invoiced": "onlyCompletedOrdersInvoiced",
  "This order already has an invoice": "orderAlreadyInvoiced",
  "Invalid status": "invalidStatus",
  "Unknown collection": "unknownCollection",
  "Not found": "notFound",
  "ids array required": "idsArrayRequired",
  "text is required": "textRequired",
  "Conversation not found": "conversationNotFound",
  "Could not send email right now.": "emailSendFailed",
  "Dette tidspunktet er nettopp booket av noen andre. Velg et annet.": "slotAlreadyBooked",
  "Failed to load conversation": "failedLoadConversation",
  "Failed to load unread count": "failedLoadUnreadCount",
  "Failed to send message": "failedSendMessage",
  "Failed to update typing status": "failedUpdateTyping",
  "Failed to load conversations": "failedLoadConversations",
  "Failed to send reply": "failedSendReply",
}

// The "email not configured" message is dynamic-ish (mentions the missing
// env vars) but always starts the same way — components also string-match
// on "not configured" to show a special UI state, so the localized text
// must keep that same substring.
const EMAIL_NOT_CONFIGURED_PREFIX = "Email sending isn't configured yet"

export function localizeApiError(rawMessage) {
  if (!rawMessage) return rawMessage
  const key = MESSAGE_TO_KEY[rawMessage]
  const dict = getCurrentLanguageDict()
  if (key) return dict.apiErrors?.[key] || no.apiErrors[key] || rawMessage
  if (rawMessage.startsWith(EMAIL_NOT_CONFIGURED_PREFIX)) {
    return dict.apiErrors?.emailNotConfigured || no.apiErrors.emailNotConfigured
  }
  return rawMessage
}
