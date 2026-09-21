// Turns an email local-part like "john.smith" into "John Smith" — used only
// as a last-resort fallback when no real name is available anywhere.
function humanizeLocalPart(localPart) {
  if (!localPart) return ""
  return localPart
    .replace(/[_.\-+]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

// Priority: application profile name -> Firebase displayName (this already
// covers Google accounts, which populate it automatically) -> a clean name
// generated from the email's local part. A bare email address is never
// returned as-is.
export function getDisplayName(profile, firebaseUser) {
  if (profile?.name) return profile.name
  if (firebaseUser?.displayName) return firebaseUser.displayName
  const email = profile?.email || firebaseUser?.email || ""
  const local = email.split("@")[0] || ""
  return humanizeLocalPart(local) || local
}

export function getInitials(profile, firebaseUser) {
  const name = getDisplayName(profile, firebaseUser)
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
