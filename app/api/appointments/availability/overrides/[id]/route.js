import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { connectDB } from "@/lib/db"
import { AvailabilityOverride } from "@/lib/models/AvailabilityOverride"
import { cleanOverride } from "@/lib/appointments/availabilityService"

async function load(params) {
  const { id } = await params
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found")
  await connectDB()
  const override = await AvailabilityOverride.findById(id)
  if (!override) throw new ApiError(404, "Not found")
  return override
}

// Edit a rule, or just switch it on/off with { active }.
export const PATCH = withApiErrors(async (request, { params }) => {
  const { user } = requirePermission(await authenticate(request), "appointments.manageAvailability")
  const override = await load(params)
  const body = (await request.json().catch(() => ({}))) || {}
  const onlyActive = Object.keys(body).length === 1 && "active" in body
  if (onlyActive) {
    override.active = Boolean(body.active)
  } else {
    override.set(cleanOverride({ ...override.toObject(), ...body }))
  }
  override.updatedBy = user._id
  await override.save()
  return NextResponse.json({ override })
})

export const DELETE = withApiErrors(async (request, { params }) => {
  requirePermission(await authenticate(request), "appointments.manageAvailability")
  const override = await load(params)
  await override.deleteOne()
  return NextResponse.json({ ok: true })
})
