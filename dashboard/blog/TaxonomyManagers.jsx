"use client"

import { useState } from "react"
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Card, Empty, ErrorNote, Spinner, btnGhost, btnPrimary, iconBtn, inputClass, isConflict } from "./adminUi"

export function CategoriesManager({ taxonomy, refresh }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState({ name: "", slug: "", description: "" })
  const [editingId, setEditingId] = useState(null)
  const [edit, setEdit] = useState({ name: "", slug: "", description: "" })
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  const fail = (err) => {
    console.error(err)
    setError(isConflict(err) ? t("blogAdmin.categories.slugTaken") : t("blogAdmin.actionFailed"))
  }

  const create = async (e) => {
    e.preventDefault()
    if (!draft.name.trim()) return
    setBusy("create")
    setError("")
    try {
      await api.post("/blog/categories", draft)
      setDraft({ name: "", slug: "", description: "" })
      await refresh()
    } catch (err) {
      fail(err)
    } finally {
      setBusy("")
    }
  }

  const saveEdit = async (id) => {
    setBusy(id)
    setError("")
    try {
      await api.patch(`/blog/categories/${id}`, edit)
      setEditingId(null)
      await refresh()
    } catch (err) {
      fail(err)
    } finally {
      setBusy("")
    }
  }

  const remove = async (c) => {
    if (!window.confirm(c.postCount > 0 ? t("blogAdmin.categories.deleteWithPosts", { name: c.name, n: c.postCount }) : t("blogAdmin.categories.deleteConfirm", { name: c.name }))) return
    setBusy(c._id)
    setError("")
    try {
      await api.delete(`/blog/categories/${c._id}`)
      await refresh()
    } catch (err) {
      fail(err)
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="space-y-[14px]">
      <Card className="p-[16px]">
        <form onSubmit={create} className="grid gap-[10px] md:grid-cols-[1fr_1fr_1.4fr_auto]">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("blogAdmin.categories.name")} aria-label={t("blogAdmin.categories.name")} maxLength={80} className={inputClass} />
          <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder={t("blogAdmin.categories.slugOptional")} aria-label={t("blogAdmin.editor.slug")} className={inputClass} />
          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={t("blogAdmin.categories.description")} aria-label={t("blogAdmin.categories.description")} maxLength={300} className={inputClass} />
          <button type="submit" disabled={busy === "create" || !draft.name.trim()} className={btnPrimary}>
            {busy === "create" ? <Spinner /> : <Plus size={15} />}
            {t("blogAdmin.categories.add")}
          </button>
        </form>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      {taxonomy.categories.length === 0 ? (
        <Empty>{t("blogAdmin.categories.empty")}</Empty>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {taxonomy.categories.map((c) => (
            <div key={c._id} className="p-[14px]">
              {editingId === c._id ? (
                <div className="grid gap-[8px] md:grid-cols-[1fr_1fr_1.4fr_auto]">
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label={t("blogAdmin.categories.name")} className={inputClass} />
                  <input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} aria-label={t("blogAdmin.editor.slug")} className={inputClass} />
                  <input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} aria-label={t("blogAdmin.categories.description")} className={inputClass} />
                  <div className="flex gap-[6px]">
                    <button type="button" onClick={() => saveEdit(c._id)} disabled={busy === c._id} className={btnPrimary} aria-label={t("blog.save")}>
                      {busy === c._id ? <Spinner /> : <Check size={15} />}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={btnGhost} aria-label={t("blog.cancel")}>
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-[10px]">
                  <div className="min-w-0">
                    <p className="text-[14px] font-[700] text-white">{c.name}</p>
                    <p className="text-[12px] text-white/40">
                      /{c.slug} · {t("blogAdmin.categories.posts", { n: c.postCount })}
                      {c.description ? ` · ${c.description}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-[2px]">
                    <button type="button" className={iconBtn} title={t("blog.edit")} aria-label={t("blog.edit")} onClick={() => { setEditingId(c._id); setEdit({ name: c.name, slug: c.slug, description: c.description }) }}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className={`${iconBtn} hover:!text-red-400`} title={t("blog.delete")} aria-label={t("blog.delete")} disabled={busy === c._id} onClick={() => remove(c)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

export function TagsManager({ taxonomy, refresh }) {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState("")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  const fail = (err) => {
    console.error(err)
    setError(isConflict(err) ? t("blogAdmin.tags.exists") : t("blogAdmin.actionFailed"))
  }

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy("create")
    setError("")
    try {
      await api.post("/blog/tags", { name })
      setName("")
      await refresh()
    } catch (err) {
      fail(err)
    } finally {
      setBusy("")
    }
  }

  const rename = async (id) => {
    setBusy(id)
    setError("")
    try {
      await api.patch(`/blog/tags/${id}`, { name: editName })
      setEditingId(null)
      await refresh()
    } catch (err) {
      fail(err)
    } finally {
      setBusy("")
    }
  }

  const remove = async (tg) => {
    if (!window.confirm(t("blogAdmin.tags.deleteConfirm", { name: tg.name, n: tg.postCount }))) return
    setBusy(tg._id)
    setError("")
    try {
      await api.delete(`/blog/tags/${tg._id}`)
      await refresh()
    } catch (err) {
      fail(err)
    } finally {
      setBusy("")
    }
  }

  const shown = taxonomy.tags.filter((tg) => tg.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="space-y-[14px]">
      <div className="flex flex-wrap gap-[10px]">
        <form onSubmit={create} className="flex min-w-[260px] flex-1 gap-[8px]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("blogAdmin.tags.newTag")} aria-label={t("blogAdmin.tags.newTag")} maxLength={40} className={inputClass} />
          <button type="submit" disabled={busy === "create" || !name.trim()} className={btnPrimary}>
            {busy === "create" ? <Spinner /> : <Plus size={15} />}
            {t("blogAdmin.categories.add")}
          </button>
        </form>
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-white/35" aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("blogAdmin.tags.search")} aria-label={t("blogAdmin.tags.search")} className={`${inputClass} !pl-[34px]`} />
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {shown.length === 0 ? (
        <Empty>{taxonomy.tags.length === 0 ? t("blogAdmin.tags.empty") : t("blogAdmin.tags.noMatch")}</Empty>
      ) : (
        <Card className="divide-y divide-white/[0.06]">
          {shown.map((tg) => (
            <div key={tg._id} className="flex flex-wrap items-center justify-between gap-[10px] px-[14px] py-[10px]">
              {editingId === tg._id ? (
                <div className="flex flex-1 gap-[8px]">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename(tg._id)} autoFocus aria-label={t("blogAdmin.tags.newTag")} maxLength={40} className={inputClass} />
                  <button type="button" onClick={() => rename(tg._id)} disabled={busy === tg._id} className={btnPrimary} aria-label={t("blog.save")}>
                    {busy === tg._id ? <Spinner /> : <Check size={15} />}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className={btnGhost} aria-label={t("blog.cancel")}>
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[14px] text-white">
                    <span className="font-[700]">#{tg.name}</span>
                    <span className="ml-[10px] text-[12px] text-white/40">{t("blogAdmin.categories.posts", { n: tg.postCount })}</span>
                  </p>
                  <div className="flex gap-[2px]">
                    <button type="button" className={iconBtn} title={t("blog.edit")} aria-label={t("blog.edit")} onClick={() => { setEditingId(tg._id); setEditName(tg.name) }}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className={`${iconBtn} hover:!text-red-400`} title={t("blog.delete")} aria-label={t("blog.delete")} disabled={busy === tg._id} onClick={() => remove(tg)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
