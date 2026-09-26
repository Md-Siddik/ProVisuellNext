"use client"

// "Continue with Google" — one button for the Login and Signup pages, so the
// icon, size, spacing and states are always the same. It only renders the
// button; signing in is lib/firebaseAuth.js loginWithGoogle(), called by the
// page's onClick (one implementation for both pages).
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.6-6.6C35.4 2.5 30 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.7 6C12.1 13 17.5 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.3 5.6c4.2-3.9 6.3-9.7 6.3-17.3z" />
      <path fill="#FBBC05" d="M10.3 19.2a14.5 14.5 0 0 0 0 9.6l-7.7 6a24 24 0 0 1 0-21.6z" />
      <path fill="#34A853" d="M24 48c6 0 11.4-2 15.2-5.4l-7.3-5.6c-2 1.4-4.7 2.2-7.9 2.2-6.5 0-12-4.4-13.9-10.4l-7.7 6C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export default function GoogleAuthButton({ label, onClick, disabled = false, busy = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className="flex w-full items-center justify-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] py-[12px] text-[14px] text-white transition hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4b00] disabled:opacity-50"
    >
      {busy ? <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/25 border-t-white" aria-hidden="true" /> : <GoogleIcon />}
      {label}
    </button>
  )
}
