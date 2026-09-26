import ProtectedRoute from "@/context/ProtectedRoute"
import DashboardLayout from "@/dashboard/DashboardLayout"

export default function AdminDashboardLayout({ children }) {
  return (
    // Staff dashboard for administrators, moderators and the Super Admin —
    // what each one sees inside is decided by permissions (DashboardLayout).
    <ProtectedRoute roles={["administrator", "moderator", "superadmin"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  )
}
