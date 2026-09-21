import { Suspense } from "react"
import Meldinger from "@/dashboard/pages/Meldinger"

export default function OwnerMeldingerPage() {
  return (
    <Suspense fallback={null}>
      <Meldinger />
    </Suspense>
  )
}
