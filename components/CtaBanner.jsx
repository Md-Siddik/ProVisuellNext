"use client"

import { OPEN_ORDER_EVENT } from "./StartOrderModal"
import EditableText from "../dashboard/editor/EditableText"

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-[20px] w-[20px] sm:h-[22px] sm:w-[22px]"
  >
    <path
      d="M5 12H19M19 12L14.5 7.5M19 12L14.5 16.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CtaBanner = () => {
  return (
    <section
      className="relative w-full overflow-hidden bg-[#0a0a0a] bg-cover bg-center"
      style={{ backgroundImage: "url(/assets/CreateBG.png)" }}
    >
      {/* A single light scrim, concentrated where the text sits (top-left in
          both the stacked-mobile and two-column-desktop layouts) and fading
          out quickly — the wave artwork stays clearly visible everywhere
          else instead of being buried under a heavy full-bleed black tint. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/70 via-black/30 to-black/[0.08]" />

      <div className="relative mx-auto grid w-full max-w-[1760px] gap-[24px] px-[18px] py-[44px] sm:px-[22px] sm:py-[56px] md:grid-cols-[1.65fr_1fr] md:items-center md:gap-[36px] md:px-[28px] md:py-[72px] lg:px-[32px] lg:py-[84px] xl:px-[40px]">
        <div>
          <p className="mb-[12px] text-[11px] font-[800] uppercase leading-none tracking-[0.08em] text-[#ff8a4d] sm:mb-[14px] sm:text-[13px]">
            <EditableText k="ctaBanner.eyebrow" />
          </p>

          <h2 className="max-w-[520px] text-[26px] font-[800] leading-[1.14] tracking-[-0.015em] text-white sm:text-[34px] sm:leading-[1.08] sm:tracking-[-0.02em] md:max-w-[610px] md:text-[38px] lg:text-[42px] xl:text-[44px]">
            <EditableText k="ctaBanner.title" />
          </h2>
        </div>

        <div className="flex flex-col items-start justify-center gap-[16px] md:pl-[22px]">
          <p className="max-w-[340px] text-[13.5px] font-[500] leading-[1.5] text-white/85 sm:text-[15px] lg:text-[16px]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.45)" }}>
            <EditableText k="ctaBanner.description" />
          </p>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_ORDER_EVENT))}
            className="group flex h-[48px] w-full items-center justify-between rounded-[10px] bg-[#ff4b00] px-[22px] text-[13px] font-[800] uppercase tracking-[0.01em] text-white transition-colors duration-300 hover:bg-white hover:text-black sm:h-[50px] sm:w-auto sm:min-w-[210px]"
          >
            <span><EditableText k="ctaBanner.ctaButton" /></span>

            <span className="ml-[22px] transition-transform duration-300 group-hover:translate-x-[4px] sm:ml-[26px]">
              <ArrowIcon />
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}

export default CtaBanner