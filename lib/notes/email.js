import { DATE_LOCALES, pickLanguage, translator } from "../i18n/server.js"
import { formatOsloDateTime } from "../appointments/time.js"

// A note / to-do reminder email, in the recipient's language and time
// format, sent through the existing mailer (lib/mailer.js). Only ever built
// for the note's creator or its shared-with group (see noteAudience).

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

export function renderReminderEmail(note, { user, firedAt, url = "", sharedBy = "" }) {
  const lang = pickLanguage(user?.language)
  const t = translator(lang)
  const when = `${formatOsloDateTime(firedAt, DATE_LOCALES[lang], user?.timeFormat || "12h")} (${t("timeFormat.norwayTime")})`
  const title = note.title || t("noteEmail.untitled")
  const items = note.checklistItems || []
  const preview = (note.content || "").slice(0, 600)
  const related = note.relatedEntityType ? `${t(`notesPage.related_${note.relatedEntityType}`)}: ${note.relatedEntityLabel}` : ""
  const open = items.filter((i) => !i.completed)
  const todo = note.kind === "todo"
  const label = t(todo ? "noteEmail.labelTodo" : "noteEmail.label")
  const openLabel = t(todo ? "noteEmail.openTodo" : "noteEmail.open")

  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 14px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#0a0a0a;padding:18px 24px;color:#fff;font-size:18px;font-weight:800">Pro<span style="color:#ff4b00">Visuell</span>
    <span style="float:right;font-size:11px;letter-spacing:0.12em;color:#8a8a8a;font-weight:700;padding-top:4px">${esc(label)}</span></td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 4px;font-size:12px;color:#71717a">${esc(when)}</p>
    <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#18181b">${esc(title)}</h1>
    ${sharedBy ? `<p style="margin:0 0 10px;font-size:12.5px;color:#71717a">${esc(t("noteEmail.sharedBy", { name: sharedBy }))}</p>` : ""}
    ${related ? `<p style="margin:0 0 14px;font-size:13px;color:#52525b"><strong>${esc(related)}</strong></p>` : ""}
    ${preview ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3f3f46;white-space:pre-wrap">${esc(preview)}${note.content.length > 600 ? "…" : ""}</p>` : ""}
    ${items.length ? `<p style="margin:0 0 6px;font-size:12px;color:#71717a">${esc(t("noteEmail.checklist", { done: items.length - open.length, total: items.length }))}</p>
    <ul style="margin:0 0 14px;padding-left:18px;font-size:14px;line-height:1.6;color:#3f3f46">${open.slice(0, 10).map((i) => `<li>${esc(i.text)}</li>`).join("")}</ul>` : ""}
    ${url ? `<a href="${esc(url)}" style="display:inline-block;margin-top:6px;background:#ff4b00;color:#fff;text-decoration:none;font-weight:800;font-size:13px;padding:11px 18px;border-radius:8px">${esc(openLabel)}</a>` : ""}
  </td></tr>
  <tr><td style="padding:0 24px 20px;font-size:11.5px;color:#a1a1aa">${esc(t("noteEmail.footer"))}</td></tr>
</table></td></tr></table></body></html>`

  const text = [
    label,
    when,
    "",
    title,
    sharedBy ? t("noteEmail.sharedBy", { name: sharedBy }) : "",
    related,
    preview,
    items.length ? `${t("noteEmail.checklist", { done: items.length - open.length, total: items.length })}\n${open.slice(0, 10).map((i) => `- ${i.text}`).join("\n")}` : "",
    url ? `\n${openLabel}: ${url}` : "",
    "",
    t("noteEmail.footer"),
  ]
    .filter((l) => l !== "")
    .join("\n")

  return { subject: t("noteEmail.subject", { title }), html, text }
}
