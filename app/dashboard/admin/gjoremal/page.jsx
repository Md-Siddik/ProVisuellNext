import { Suspense } from "react"
import Todo from "@/dashboard/pages/Todo"

export default function AdminTodoPage() {
  return (
    <Suspense fallback={null}>
      <Todo />
    </Suspense>
  )
}
