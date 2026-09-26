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
import { ro } from "./locales/ro"
import { getPreference } from "../cookieConsent/preferenceStorage"

const DICTS = { no, en, sv, fi, da, ro }
const STORAGE_KEY = "provisuell_language"

function getCurrentLanguage() {
  try {
    const v = getPreference(STORAGE_KEY)
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
  "Passwords do not match": "passwordsDoNotMatch",
  "Password must be at least 6 characters": "weakPassword",
  "Password is too long": "passwordTooLong",
  "An account with this email already exists": "emailAlreadyInUse",
  "Please wait a minute before requesting another email": "verificationRateLimited",
  "This verification link is invalid or has expired": "verificationLinkInvalid",
  "Could not create the account right now": "accountCreateFailed",
  "This appointment time is no longer available.": "slotUnavailable",
  "Invalid override type": "invalidOverrideType",
  "A date is required": "dateRequired",
  "A start and end date are required": "startEndDateRequired",
  "Pick at least one weekday": "pickWeekday",
  "The end date is before the start date": "endDateBeforeStart",
  "Pick the whole day, a time range, or individual slots": "pickTimes",
  "The end time is before the start time": "endTimeBeforeStart",
  "Invalid weekly schedule": "invalidWeeklySchedule",
  "Invalid time format": "invalidTimeFormat",
  "Invalid date": "invalidDate",
  "The Super Admin account can't be modified": "superAdminProtected",
  "Invalid role": "invalidRole",
  "Unknown permission": "unknownPermission",
  "Invalid permission state": "invalidPermissionState",
  "This permission is reserved for the Super Admin": "permissionReserved",
  "User not found": "userNotFound",
  "Nothing to change": "nothingToChange",
  "The meeting hasn't started yet.": "meetingNotStarted",
  "This meeting has already ended.": "meetingEnded",
  "This meeting was cancelled.": "meetingCancelled",
  "This appointment has already started and can't be cancelled.": "cancelClosed",
  "Appointments can only be rescheduled at least 1 hour before they start.": "rescheduleClosed",
  "No meeting link is configured.": "noMeetingLink",
  "Invalid payment amount": "invalidPaymentAmount",
  "Invalid language": "invalidLanguage",
  "Note not found": "noteNotFound",
  "Invalid related record": "invalidRelated",
  "Related record not found": "relatedNotFound",
  "Invalid note type": "invalidNoteType",
  "Invalid checklist": "invalidChecklist",
  "Too many checklist items": "tooManyItems",
  "Pick a reminder date and time": "pickReminder",
  "The reminder time must be in the future": "reminderInFuture",
  "The expiry date must be in the future": "expiryInFuture",
  "Write a title, some text or a checklist item": "noteEmpty",
  "Invalid time": "invalidTime",
  "That time doesn't exist on this date (daylight saving change)": "dstGap",
  "The file is empty": "fileEmpty",
  "Files can be at most 10 MB": "fileTooLarge",
  "This file type isn't allowed": "fileTypeNotAllowed",
  "Too many attachments": "tooManyAttachments",
  "Invalid user": "invalidUser",
  "Invalid id": "invalidId",
  "Invalid sharing option": "invalidShare",
  "Write the task": "writeTask",
  "Only the note's creator can change this": "notNoteOwner",
  "You have view-only access to this note": "noteViewOnly",
  "Invalid share recipient": "invalidShareRecipient",
  "Too many share recipients": "tooManyShareRecipients",
  "This account has been banned": "accountSuspended",
  "You can't change your own account here": "cantChangeOwnAccount",
  "Invalid account status": "invalidAccountStatus",
  "This role's permissions can't be changed": "roleNotEditable",
  "Invalid permission list": "invalidPermissionList",
  "Unban this account before deleting it": "unbanBeforeDelete",
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
