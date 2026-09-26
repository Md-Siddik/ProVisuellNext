import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { CUSTOMER_CONTACT_FIELDS, can, redact, requirePermission } from "@/lib/access"
import { Appointment } from "@/lib/models/Appointment"
import { meetingRoomUrl } from "@/lib/meeting"
import { Order } from "@/lib/models/Order"
import { withAttendance } from "@/lib/appointments/attendance"

export const GET = withApiErrors(async (request) => {
  const auth = requirePermission(await authenticate(request), "appointments.view")

  const params = new URL(request.url).searchParams
  const from = params.get("from")
  const to = params.get("to")
  const customerEmail = params.get("customerEmail")
  const status = params.get("status")

  const query = {}
  if (from || to) {
    query.start = {}
    if (from) query.start.$gte = new Date(from)
    if (to) query.start.$lte = new Date(to)
  }
  // Filtering by email would let a viewer probe addresses they can't see.
  if (customerEmail && can(auth, "customers.viewEmail")) {
    query.requestedByEmail = new RegExp(`^${customerEmail.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
  }
  if (status) query.status = status
  const id = params.get("id")
  if (id) {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid id")
    query._id = id
  }
  const appointments = await Appointment.find(query).sort({ start: 1 })

  // Attach the linked order (if any) so the calendar can show what an
  // appointment turned into — customer name, status, and the dates the
  // status badge needs — without a separate lookup per block.
  const ids = appointments.map((a) => a._id)
  const orders = await Order.find({ appointmentId: { $in: ids } }).select(
    "appointmentId orderNumber status customerName createdAt expectedDeliveryDate completedAt"
  )
  const orderByAppointment = new Map(orders.map((o) => [String(o.appointmentId), o]))

  return NextResponse.json({
    appointments: appointments.map((a) => {
      const order = orderByAppointment.get(String(a._id))
      return {
        // Moderators and others without customers.viewEmail don't get the address.
        ...redact(auth, withAttendance(a), CUSTOMER_CONTACT_FIELDS),
        linkedOrder: order
          ? {
              _id: order._id,
              orderNumber: order.orderNumber,
              status: order.status,
              customerName: order.customerName,
              createdAt: order.createdAt,
              expectedDeliveryDate: order.expectedDeliveryDate,
              completedAt: order.completedAt,
            }
          : null,
      }
    }),
  })
})

export const POST = withApiErrors(async (request) => {
  const { user } = requirePermission(await authenticate(request), "appointments.create")

  const { title, start, end, name, email, notes } = (await request.json().catch(() => ({}))) || {}
  if (!title || !start || !end) {
    throw new ApiError(400, "title, start and end are required")
  }
  const appointment = await Appointment.create({
    title,
    start,
    end,
    requestedByName: name || user.name || "Internt møte",
    requestedByEmail: email || user.email,
    notes: notes || "",
    meetingUrl: meetingRoomUrl(),
    createdBy: user._id,
  })
  const { meetingUrl: _omit, ...safe } = appointment.toObject()
  return NextResponse.json({ appointment: safe }, { status: 201 })
})
