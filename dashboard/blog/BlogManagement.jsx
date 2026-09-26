"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ChartColumn,
  FileEdit,
  FileText,
  FolderTree,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  MessageCircle,
  PenSquare,
  Plus,
  Settings,
  Tags,
} from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { useAuth } from "@/context/AuthContext"
import { btnPrimary } from "./adminUi"
import PostsList from "./PostsList"
import PostEditor from "./PostEditor"
import { CategoriesManager, TagsManager } from "./TaxonomyManagers"
import CommentsModeration from "./CommentsModeration"
import MediaLibrary from "./MediaLibrary"
import BlogSettings from "./BlogSettings"
import { Analytics, Overview } from "./OverviewAnalytics"

// Everything blog-related lives inside this one workspace — the dashboard
// sidebar only carries a single "Blog Management" entry, the same way the
// Website Editor is a single entry with its own controls on the right.
const SECTIONS = [
  { id: "overview", icon: LayoutDashboard, label: "blogAdmin.nav.overview" },
  { id: "posts", icon: FileText, label: "blogAdmin.nav.posts" },
  { id: "create", icon: PenSquare, label: "blogAdmin.nav.create", action: true, need: "blog.create" },
  { id: "drafts", icon: FileEdit, label: "blogAdmin.nav.drafts" },
  { id: "published", icon: Globe, label: "blogAdmin.nav.published" },
  { id: "categories", icon: FolderTree, label: "blogAdmin.nav.categories", need: "blog.edit" },
  { id: "tags", icon: Tags, label: "blogAdmin.nav.tags", need: "blog.edit" },
  { id: "comments", icon: MessageCircle, label: "blogAdmin.nav.comments", need: "blog.moderateComments" },
  { id: "media", icon: ImageIcon, label: "blogAdmin.nav.media" },
  { id: "analytics", icon: ChartColumn, label: "blogAdmin.nav.analytics", need: "blog.analytics" },
  { id: "settings", icon: Settings, label: "blogAdmin.nav.settings", need: "blog.settings" },
]

export default function BlogManagement() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const sections = SECTIONS.filter((s) => !s.need || can(s.need))
  const [section, setSection] = useState("overview")
  // null = not editing; { id: null } = new post; { id: "…" } = existing post.
  const [editing, setEditing] = useState(null)
  const [taxonomy, setTaxonomy] = useState({ categories: [], tags: [] })

  const refreshTaxonomy = useCallback(async () => {
    try {
      setTaxonomy(await api.get("/blog/admin/taxonomy"))
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    refreshTaxonomy()
  }, [refreshTaxonomy])

  const openCreate = () => setEditing({ id: null })
  const openEdit = (id) => setEditing({ id })
  const go = (id) => {
    setEditing(null)
    setSection(id)
  }

  const current = SECTIONS.find((s) => s.id === section)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">{t("nav.blogManagement")}</h1>
          <p className="mt-[4px] text-[14px] text-white/50">{t("blogAdmin.subtitle")}</p>
        </div>
        {!editing && can("blog.create") && (
          <button type="button" onClick={openCreate} className={btnPrimary}>
            <Plus size={15} />
            {t("blogAdmin.createPost")}
          </button>
        )}
      </div>

      <div className="mt-[20px] grid gap-[16px] lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label={t("nav.blogManagement")} className="grid grid-cols-2 gap-[6px] sm:grid-cols-3 lg:sticky lg:top-0 lg:grid-cols-1 lg:self-start">
          {sections.map(({ id, icon: Icon, label, action }) => {
            const active = action ? Boolean(editing && editing.id === null) : !editing && section === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => (action ? openCreate() : go(id))}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-[10px] rounded-[10px] border px-[12px] py-[10px] text-left text-[13px] font-[600] transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00] ${
                  active ? "border-[#ff4b00]/40 bg-[#ff4b00]/10 text-[#ff4b00]" : "border-transparent text-white/65 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{t(label)}</span>
              </button>
            )
          })}
        </nav>

        <section className="min-w-0" aria-label={editing ? t("blogAdmin.nav.create") : t(current.label)}>
          {editing ? (
            <PostEditor
              key={editing.id || "new"}
              postId={editing.id}
              taxonomy={taxonomy}
              refreshTaxonomy={refreshTaxonomy}
              onClose={() => setEditing(null)}
            />
          ) : (
            <>
              <h2 className="mb-[14px] text-[17px] font-[800] text-white">{t(current.label)}</h2>
              {section === "overview" && <Overview onCreate={openCreate} onEdit={openEdit} onOpen={go} />}
              {section === "posts" && <PostsList preset="all" taxonomy={taxonomy} onEdit={openEdit} onCreate={openCreate} />}
              {section === "drafts" && <PostsList preset="draft" taxonomy={taxonomy} onEdit={openEdit} onCreate={openCreate} />}
              {section === "published" && <PostsList preset="published" taxonomy={taxonomy} onEdit={openEdit} onCreate={openCreate} />}
              {section === "categories" && <CategoriesManager taxonomy={taxonomy} refresh={refreshTaxonomy} />}
              {section === "tags" && <TagsManager taxonomy={taxonomy} refresh={refreshTaxonomy} />}
              {section === "comments" && <CommentsModeration />}
              {section === "media" && <MediaLibrary />}
              {section === "analytics" && <Analytics />}
              {section === "settings" && <BlogSettings />}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
