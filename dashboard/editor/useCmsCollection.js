"use client"

import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { useEditorMode } from "./EditorModeContext"

// Resolves one raw multi-language item (as returned by the admin endpoint)
// down to the current UI language, same fallback chain as the backend's
// public endpoint uses — so admin-mode preview and public rendering agree.
function resolveItem(raw, language) {
  const resolved = {
    _id: raw._id,
    published: raw.published,
    order: raw.order,
    link: raw.link || "",
    image: raw.image || "",
    video: raw.video || "",
    raw,
  }
  const translations = raw.translations || {}
  for (const [field, values] of Object.entries(translations)) {
    resolved[field] = values?.[language] || values?.no || Object.values(values || {}).find(Boolean) || ""
  }
  return resolved
}

// One reusable data hook for every dynamic marketing-site collection
// (services, portfolioItems, featuredProjects) — public visitors get only
// published items already resolved to their language; the Website Editor
// gets everything (including hidden items) so it can be edited.
export function useCmsCollection(collectionKey) {
  const { language } = useTranslation()
  const { enabled } = useEditorMode()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      if (enabled) {
        const { items: raw } = await api.get(`/cms-collections/${collectionKey}/admin`)
        setItems(raw.map((r) => resolveItem(r, language)))
      } else {
        const { items: resolved } = await api.public.get(`/cms-collections/${collectionKey}?lang=${language}`)
        setItems(resolved)
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [collectionKey, enabled, language])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addItem = useCallback(
    async (payload) => {
      await api.post(`/cms-collections/${collectionKey}`, payload)
      await refresh()
    },
    [collectionKey, refresh]
  )

  const updateItem = useCallback(
    async (id, payload) => {
      await api.put(`/cms-collections/${collectionKey}/${id}`, payload)
      await refresh()
    },
    [collectionKey, refresh]
  )

  const deleteItem = useCallback(
    async (id) => {
      await api.delete(`/cms-collections/${collectionKey}/${id}`)
      await refresh()
    },
    [collectionKey, refresh]
  )

  const reorder = useCallback(
    async (ids) => {
      await api.post(`/cms-collections/${collectionKey}/reorder`, { ids })
      await refresh()
    },
    [collectionKey, refresh]
  )

  return { items, loading, refresh, addItem, updateItem, deleteItem, reorder }
}