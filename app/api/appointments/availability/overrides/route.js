import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import { AvailabilityOverride } from "@/lib/models/AvailabilityOverride"
import { cleanOverride } from "@/lib/appointments/availabilityService"

const STAFF = ["owner", "administrator"]

export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, STAFF)
  await connectDB()
  const overrides = await AvailabilityOverride.find({}).sort({ active: -1, startDate: 1, createdAt: -1 }).lean()
  return NextResponse.json({ overrides })
})

export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, STAFF)
  const data = cleanOverride(await request.json().catch(() => ({})))
  await connectDB()
  const override = await AvailabilityOverride.create({ ...data, createdBy: user._id, updatedBy: user._id })
  return NextResponse.json({ override }, { status: 201 })
})
