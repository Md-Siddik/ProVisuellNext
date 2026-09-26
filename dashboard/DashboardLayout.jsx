"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarClock,
  CalendarCog,
  Lock,
  StickyNote,
  ListChecks,
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
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react"
import Logo from "../components/Logo"
import NotificationBell from "../components/NotificationBell"
import LanguageSelector from "../components/LanguageSelector"
import UnreadBadge from "../components/UnreadBadge"
import { useAuth } from "@/context/AuthContext"
import { logout } from "@/lib/firebaseAuth"
import { getDisplayName, getInitials } from "@/lib/displayName"
import { useUnreadMessages } from "@/hooks/useUnreadMessages"
import { useTranslation } from "@/lib/i18n"
import { useNotes } from "@/context/NotesContext"

// Each entry names the permission it needs; entries the viewer lacks are
// not shown at all (and their pages are blocked below). The API enforces the
// same permissions independently — this only decides visibility.
function navItemsFor(t, { can, isSuperAdmin, base }) {
  const items = [
    { to: "/", end: true, label: t("nav.home"), icon: Home },
    { to: `${base}`, end: true, label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: `${base}/ansattmoter`, label: t("nav.appointments"), icon: CalendarClock, need: ["appointments.view"] },
    { to: `${base}/motetilgjengelighet`, label: t("nav.meetingAvailability"), icon: CalendarCog, need: ["appointments.manageAvailability"] },
    { to: `${base}/meldinger`, label: t("nav.messages"), icon: MessageSquare, need: ["messages.view", "messages.viewEmailInbox"] },
    { to: `${base}/ordre/ny`, label: t("nav.newOrder"), icon: FilePlus2, need: ["orders.create"] },
    { to: `${base}/ordreoversikt`, label: t("nav.orderOverview"), icon: ClipboardList, need: ["orders.view"] },
    { to: `${base}/kundebetalinger`, label: t("nav.customerPayments"), icon: CreditCard, need: ["invoices.view"] },
    { to: `${base}/utgifter`, label: t("nav.expenses"), icon: Wallet, need: ["expenses.view"] },
    { to: `${base}/rapporter`, label: t("nav.reports"), icon: TrendingUp, need: ["reports.view"] },
    { to: `${base}/lokasjoner`, label: t("nav.locations"), icon: MapPin, need: ["customers.viewLocation"] },
    { to: `${base}/notater`, label: t("nav.notes"), icon: StickyNote, need: ["notes.view"] },
    { to: `${base}/gjoremal`, label: t("nav.todo"), icon: ListChecks, need: ["notes.view"] },
  ]
  // The Website Editor only exists in the admin area.
  if (base === "/dashboard/admin") {
    items.push({ to: `${base}/website-editor`, label: t("nav.websiteEditor"), icon: Globe, need: ["cms.view", "cms.edit"] })
  }
  items.push({ to: `${base}/blog`, label: t("nav.blogManagement"), icon: Newspaper, need: ["blog.view"] })
  if (isSuperAdmin) {
    items.push({ to: `${base}/superadmin`, label: t("nav.superAdmin"), icon: ShieldCheck, superAdminOnly: true })
  }
  // Visible when the viewer holds any one of the listed permissions.
  return items.filter((i) => (i.superAdminOnly ? isSuperAdmin : !i.need || i.need.some(can)))
}

// Every permission-gated dashboard section, including ones hidden from the
// nav, so typing the URL directly doesn't render a page the viewer can't use.
const SECTION_NEEDS = {
  ansattmoter: ["appointments.view"],
  motetilgjengelighet: ["appointments.manageAvailability"],
  meldinger: ["messages.view", "messages.viewEmailInbox"],
  ordre: ["orders.create"],
  ordreoversikt: ["orders.view"],
  kundebetalinger: ["invoices.view"],
  utgifter: ["expenses.view"],
  rapporter: ["reports.view"],
  lokasjoner: ["customers.viewLocation"],
  "website-editor": ["cms.view", "cms.edit"],
  blog: ["blog.view"],
  notater: ["notes.view"],
  gjoremal: ["notes.view"],
}

function sectionAllowed(pathname, { can, isSuperAdmin }) {
  const section = pathname.split("/")[3]
  if (!section) return true
  if (section === "superadmin") return isSuperAdmin
  const need = SECTION_NEEDS[section]
  return !need || need.some(can)
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
  const { profile, role, firebaseUser, can, isSuperAdmin } = useAuth()
  const pathname = usePathname()
  const { t } = useTranslation()
  const ROLE_LABEL = {
    superadmin: t("roles.superadmin"),
    owner: t("roles.owner"),
    administrator: t("roles.administrator"),
    moderator: t("roles.moderator"),
    customer: t("roles.customer"),
  }
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"
  const items = navItemsFor(t, { can, isSuperAdmin, base })
  const allowed = sectionAllowed(pathname, { can, isSuperAdmin })
  const { enabled: notesEnabled, openNewNote } = useNotes()
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
          <LanguageSelector variant="menu" className="px-[14px] pb-[8px]" />
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
            {/* Global quick note (not linked to a record). */}
            {notesEnabled && (
              <button
                type="button"
                onClick={() => openNewNote(null)}
                aria-label={t("notesPage.quickNote")}
                title={t("notesPage.quickNote")}
                className="flex h-[38px] items-center gap-[7px] rounded-full border border-white/15 px-[12px] text-[12.5px] font-[700] text-white/75 transition-colors hover:border-[#ff4b00]/50 hover:text-white"
              >
                <StickyNote size={16} className="text-[#ff4b00]" />
                <span className="hidden sm:inline">{t("notesPage.quickNote")}</span>
              </button>
            )}
            <div className="hidden md:block">
              <LanguageSelector />
            </div>
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
          {allowed ? (
            children
          ) : (
            <div className="mx-auto mt-[60px] max-w-[420px] rounded-[14px] border border-white/[0.08] bg-[#111212] p-[28px] text-center">
              <span className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full bg-white/[0.06] text-white/60">
                <Lock size={20} />
              </span>
              <h1 className="mt-[14px] text-[18px] font-[800] text-white">{t("permissionsUi.noAccessTitle")}</h1>
              <p className="mt-[6px] text-[13.5px] text-white/55">{t("permissionsUi.noAccessText")}</p>
              <Link href={base} className="mt-[18px] inline-block rounded-[10px] bg-[#ff4b00] px-[16px] py-[9px] text-[13px] font-[800] text-white hover:brightness-110">
                {t("nav.dashboard")}
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}