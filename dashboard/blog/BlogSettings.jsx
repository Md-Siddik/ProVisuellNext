"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Card, ErrorNote, LoadingBlock } from "./adminUi"

export default function BlogSettings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = () =>
    api
      .get("/blog/settings")
      .then((res) => setSettings(res.settings))
      .catch((err) => {
        console.error(err)
        setError(t("blogAdmin.loadFailed"))
      })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async (value) => {
    setSaving(true)
    setError("")
    const before = settings
    setSettings({ ...settings, requireCommentApproval: value })
    try {
      const res = await api.patch("/blog/settings", { requireCommentApproval: value })
      setSettings(res.settings)
    } catch (err) {
      console.error(err)
      setSettings(before)
      setError(t("blogAdmin.actionFailed"))
    } finally {
      setSaving(false)
    }
  }

  if (!settings && !error) return <LoadingBlock rows={2} />

  return (
    <div className="space-y-[14px]">
      <ErrorNote onRetry={load}>{error}</ErrorNote>
      {settings && (
        <Card className="p-[18px]">
          <label className="flex cursor-pointer items-start gap-[12px]">
            <input
              type="checkbox"
              checked={settings.requireCommentApproval}
              disabled={saving}
              onChange={(e) => toggle(e.target.checked)}
              className="mt-[3px] h-[16px] w-[16px] accent-[#ff4b00]"
            />
            <span>
              <span className="block text-[14px] font-[700] text-white">{t("blogAdmin.settings.moderation")}</span>
              <span className="mt-[3px] block text-[12.5px] leading-[1.55] text-white/50">{t("blogAdmin.settings.moderationHint")}</span>
            </span>
          </label>
        </Card>
      )}
    </div>
  )
}
