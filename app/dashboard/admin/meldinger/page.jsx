import { Suspense } from "react"
import Meldinger from "@/dashboard/pages/Meldinger"

export default function AdminMeldingerPage() {
  return (
    <Suspense fallback={null}>
      <Meldinger />
    </Suspense>
  )
}
