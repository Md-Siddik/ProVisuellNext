import { Suspense } from "react"
import Notes from "@/dashboard/pages/Notes"

export default function AdminNotesPage() {
  return (
    <Suspense fallback={null}>
      <Notes />
    </Suspense>
  )
}
