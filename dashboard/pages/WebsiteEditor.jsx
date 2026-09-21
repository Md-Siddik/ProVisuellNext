"use client"

import { useTranslation } from "@/lib/i18n"

import { Pencil } from "lucide-react"
import { EditorModeProvider } from "../editor/EditorModeContext"
import Header from "../../components/Header"
import Hero from "../../components/Hero"
import Intro from "../../components/Intro"
import Pillars from "../../components/Pillars"
import Portfolio from "../../components/Portfolio"
import Results from "../../components/Results"
import CtaBanner from "../../components/CtaBanner"
import Footer from "../../components/Footer"

// Renders the real public marketing site — same components, same styling —
// inside an EditorModeProvider so every EditableText/EditableImage inside
// them switches from plain output to double-click-to-edit. Nothing here is
// a rebuilt or approximated preview.
export default function WebsiteEditor() {
  const { t } = useTranslation()
  return (
    <EditorModeProvider>
      <div className="-m-[20px] lg:-m-[32px]">
        {/* Sticky (not fixed) so it stays scoped to the dashboard's own
            scrollable content area instead of floating over the real
            DashboardLayout topbar. A small floating pill rather than a
            full-width bar — it used to sit flush against the preview's own
            Header, crowding whatever was directly underneath it. */}
        <div className="sticky top-[8px] z-[300] mx-auto mb-[8px] flex w-fit items-center gap-[8px] rounded-full bg-[#ff4b00] px-[14px] py-[7px] text-[11px] font-[700] uppercase tracking-[0.04em] text-white shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
          <Pencil size={12} />
          {t("editor.modeBanner")}
        </div>
        {/* Header.jsx uses position:fixed for the real site's viewport-pinned
            navbar. `transform` on this wrapper makes it the containing block
            for that fixed element instead, so it stays pinned to the top of
            this preview (and scrolls with the dashboard, not the browser
            window) rather than floating over the dashboard's own chrome. */}
        <div className="relative bg-paper text-ink" style={{ transform: "translateZ(0)" }}>
          <Header />
          <main>
            <Hero />
            <Intro />
            <Pillars />
            <Portfolio />
            <Results />
            <CtaBanner />
          </main>
          <Footer />
        </div>
      </div>
    </EditorModeProvider>
  )
}