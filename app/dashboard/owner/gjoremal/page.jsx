import { Suspense } from "react"
import Todo from "@/dashboard/pages/Todo"

export default function OwnerTodoPage() {
  return (
    <Suspense fallback={null}>
      <Todo />
    </Suspense>
  )
}
