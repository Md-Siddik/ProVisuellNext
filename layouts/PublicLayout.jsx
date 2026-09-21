"use client"

import { usePathname } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import ChatWidget from "@/components/ChatWidget"
import StartOrderModal from "@/components/StartOrderModal"

// Wraps every public-facing route (marketing site, login/signup, the
// customer's own pages) so the navbar and footer are always present no
// matter which of those routes is open. The Owner/Administrator dashboard
// intentionally does NOT use this — it has its own sidebar+topbar shell.
export default function PublicLayout({ children }) {
  // Only the homepage renders MobileActionBar (see MarketingSite.jsx) — its
  // fixed bottom bar would otherwise sit on top of the footer's last row.
  const isHome = usePathname() === "/"

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header />
      {children}
      <Footer />
      {isHome && (
        <div className="lg:hidden [height:calc(84px+env(safe-area-inset-bottom,0px))]" />
      )}
      <ChatWidget />
      <StartOrderModal />
    </div>
  )
}
