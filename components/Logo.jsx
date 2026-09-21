"use client"

// Plain brand mark — wrap it in a <Link>/<a> at the call site if it needs
// to be clickable, so it never ends up nesting anchors.
export default function Logo({ className = '' }) {
  return (
    <span
      aria-label="ProVisuell"
      translate="no"
      className={`notranslate inline-flex items-baseline font-display text-[22px] font-bold tracking-[-0.04em] ${className}`}
    >
      <span className="text-orange">Pro</span>
      <span className="text-white">Visuell</span>
    </span>
  )
}