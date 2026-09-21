import ProtectedRoute from "@/context/ProtectedRoute"
import DashboardLayout from "@/dashboard/DashboardLayout"

export default function AdminDashboardLayout({ children }) {
  return (
    <ProtectedRoute roles={["administrator"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  )
}
