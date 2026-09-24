"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarClock,
  CalendarCog,
  ClipboardList,
  CreditCard,
  FilePlus2,
  Globe,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MapPin,
  Newspaper,
  MessageSquare,
  Settings,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react"
import Logo from "../components/Logo"
import NotificationBell from "../components/NotificationBell"
import UnreadBadge from "../components/UnreadBadge"
import { useAuth } from "@/context/AuthContext"
import { logout } from "@/lib/firebaseAuth"
import { getDisplayName, getInitials } from "@/lib/displayName"
import { useUnreadMessages } from "@/hooks/useUnreadMessages"
import { useTranslation } from "@/lib/i18n"

function navItemsFor(t, role, base) {
  const items = [
    { to: "/", end: true, label: t("nav.home"), icon: Home },
    { to: `${base}`, end: true, label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: `${base}/ansattmoter`, label: t("nav.appointments"), icon: CalendarClock },
    { to: `${base}/motetilgjengelighet`, label: t("nav.meetingAvailability"), icon: CalendarCog },
    { to: `${base}/meldinger`, label: t("nav.messages"), icon: MessageSquare },
  ]
  items.push({ to: `${base}/ordre/ny`, label: t("nav.newOrder"), icon: FilePlus2 })
  items.push({ to: `${base}/ordreoversikt`, label: t("nav.orderOverview"), icon: ClipboardList })
  items.push({ to: `${base}/kundebetalinger`, label: t("nav.customerPayments"), icon: CreditCard })
  items.push({ to: `${base}/utgifter`, label: t("nav.expenses"), icon: Wallet })
  items.push({ to: `${base}/rapporter`, label: t("nav.reports"), icon: TrendingUp })
  items.push({ to: `${base}/lokasjoner`, label: t("nav.locations"), icon: MapPin })
  if (role === "administrator") {
    items.push({ to: `${base}/website-editor`, label: t("nav.websiteEditor"), icon: Globe })
  }
  items.push({ to: `${base}/blog`, label: t("nav.blogManagement"), icon: Newspaper })
  return items
}

// Mirrors react-router's default NavLink matching: an `end` item matches
// only the exact path, otherwise it also matches any nested sub-path (but
// not a sibling that merely shares the same string prefix, e.g.
// "/dashboard/admin/ordre" must not light up for "/dashboard/admin/ordreoversikt").
function isNavItemActive(pathname, item) {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function NavList({ items, unreadMessages, onNavigate }) {
  const pathname = usePathname()
  return (
    <>
      {items.map((item) => {
        const isActive = isNavItemActive(pathname, item)
        return (
          <Link
            key={item.to}
            href={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-[12px] rounded-[10px] px-[14px] py-[11px] text-[14px] font-[600] transition-colors ${
              isActive
                ? "border border-[#ff4b00]/40 bg-[#ff4b00]/10 text-[#ff4b00]"
                : "text-white/65 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            <item.icon size={17} />
            {item.label}
            {item.to.endsWith("/meldinger") && <UnreadBadge count={unreadMessages} className="ml-auto" />}
          </Link>
        )
      })}
    </>
  )
}

export default function DashboardLayout({ children }) {
  const { profile, role, firebaseUser } = useAuth()
  const pathname = usePathname()
  const { t } = useTranslation()
  const ROLE_LABEL = { owner: t("roles.owner"), administrator: t("roles.administrator"), customer: t("roles.customer") }
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"
  const items = navItemsFor(t, role, base)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // A dedicated badge on the "Meldinger" icon itself, separate from (and in
  // addition to) the generic notification bell, so a new customer message
  // is visible without opening the bell dropdown. Shared with the public
  // header and dashboard home via the same hook, so all three agree.
  const unreadMessages = useUnreadMessages()

  const initials = getInitials(profile, firebaseUser) || "?"

  // A route change (e.g. tapping a nav link) should always close the mobile
  // drawer — otherwise it's still open, covering the page it just navigated to.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-black text-white">
      <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0a0a0a] px-[20px] py-[24px] lg:flex">
        <Logo className="shrink-0 px-[8px] text-[22px]" />

        <nav className="mt-[32px] min-h-0 flex-1 space-y-[4px] overflow-y-auto">
          <NavList items={items} unreadMessages={unreadMessages} />
        </nav>

        <div className="mt-auto flex shrink-0 flex-col gap-[4px] border-t border-white/[0.08] pt-[14px]">
          <button className="flex items-center gap-[12px] rounded-[10px] px-[14px] py-[11px] text-[14px] font-[600] text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white">
            <Settings size={17} />
            {t("nav.settings")}
          </button>
          <button
            onClick={() => logout()}
            className="flex items-center gap-[12px] rounded-[10px] px-[14px] py-[11px] text-[14px] font-[600] text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <LogOut size={17} />
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar drawer — the desktop <aside> above is display:none
          below lg, so without this, nothing (including Messages) is
          reachable on a phone at all. */}
      <div
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-[80] flex w-[270px] max-w-[80vw] flex-col border-r border-white/[0.08] bg-[#0a0a0a] px-[18px] py-[20px] transition-transform duration-300 lg:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between">
          <Logo className="px-[4px] text-[19px]" />
          <button
            type="button"
            aria-label={t("header.menuAriaLabel")}
            onClick={() => setMobileNavOpen(false)}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] text-white/70 hover:bg-white/[0.06] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-[24px] min-h-0 flex-1 space-y-[4px] overflow-y-auto">
          <NavList items={items} unreadMessages={unreadMessages} onNavigate={() => setMobileNavOpen(false)} />
        </nav>

        <div className="mt-auto flex shrink-0 flex-col gap-[4px] border-t border-white/[0.08] pt-[14px]">
          <button
            onClick={() => logout()}
            className="flex items-center gap-[12px] rounded-[10px] px-[14px] py-[11px] text-[14px] font-[600] text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <LogOut size={17} />
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between gap-[10px] border-b border-white/[0.08] bg-[#0a0a0a] px-[14px] sm:px-[20px] lg:px-[28px]">
          <div className="flex min-w-0 items-center gap-[10px]">
            <button
              type="button"
              aria-label={t("header.menuAriaLabel")}
              onClick={() => setMobileNavOpen(true)}
              className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[8px] border border-white/15 text-white lg:hidden"
            >
              <Menu size={18} />
            </button>
            <Logo className="shrink-0 text-[17px] lg:hidden" />
            <span className="hidden truncate text-[15px] font-[600] text-white/80 lg:block">
              {items.find((i) => pathname === i.to)?.label || t("nav.dashboard")}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-[10px] sm:gap-[14px]">
            <NotificationBell />
            <div className="flex items-center gap-[10px]">
              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 text-[13px] font-[700] text-[#ff4b00]">
                {initials}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-[700] leading-none text-white">
                  {getDisplayName(profile, firebaseUser)}
                </p>
                <p className="mt-[3px] text-[11px] leading-none text-white/45">{ROLE_LABEL[role] || role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#0d0d0d] p-[14px] sm:p-[20px] lg:p-[32px]">
          {children}
        </main>
      </div>
    </div>
  )
}