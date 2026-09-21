"use client"

import { Plus } from "lucide-react"

export default function AddCmsItemButton({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="pv-add-item-btn">
      <Plus size={15} />
      {label}
    </button>
  )
}