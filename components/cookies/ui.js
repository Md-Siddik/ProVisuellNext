// Shared look for the cookie banner and preferences panel — the same dark
// panel, orange accent and rounded buttons as the site's other modals
// (e.g. StartOrderModal). "Only necessary" is exactly as prominent as
// "Accept all": refusing must be as easy as accepting.
const base =
  "inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-[16px] text-[13.5px] font-[800] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4b00]"

export const primaryBtn = `${base} bg-[#ff4b00] text-white hover:bg-[#e64400]`
export const secondaryBtn = `${base} border border-white/20 bg-white/[0.04] text-white hover:bg-white/[0.1]`
export const ghostBtn = `${base} text-white/75 underline-offset-4 hover:text-white hover:underline`
export const panel = "border border-white/10 bg-[#111212] text-white shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
