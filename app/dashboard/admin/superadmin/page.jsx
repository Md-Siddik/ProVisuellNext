import SuperAdmin from "@/dashboard/pages/SuperAdmin"

// Rendered only for the protected Super Admin (DashboardLayout blocks everyone
// else); the data comes from /api/superadmin, which re-checks server-side.
export default function SuperAdminPage() {
  return <SuperAdmin />
}
