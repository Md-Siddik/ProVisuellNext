import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { connectDB } from "@/lib/db"
import { AvailabilityOverride } from "@/lib/models/AvailabilityOverride"
import { cleanOverride } from "@/lib/appointments/availabilityService"

export const GET = withApiErrors(async (request) => {
  requirePermission(await authenticate(request), "appointments.manageAvailability")
  await connectDB()
  const overrides = await AvailabilityOverride.find({}).sort({ active: -1, startDate: 1, createdAt: -1 }).lean()
  return NextResponse.json({ overrides })
})

export const POST = withApiErrors(async (request) => {
  const { user } = requirePermission(await authenticate(request), "appointments.manageAvailability")
  const data = cleanOverride(await request.json().catch(() => ({})))
  await connectDB()
  const override = await AvailabilityOverride.create({ ...data, createdBy: user._id, updatedBy: user._id })
  return NextResponse.json({ override }, { status: 201 })
})
