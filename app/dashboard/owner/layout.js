import ProtectedRoute from "@/context/ProtectedRoute"
import DashboardLayout from "@/dashboard/DashboardLayout"

export default function OwnerDashboardLayout({ children }) {
  return (
    <ProtectedRoute roles={["owner"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  )
}
