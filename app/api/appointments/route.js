import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors, ApiError } from "@/lib/auth"
import { Appointment } from "@/lib/models/Appointment"
import { Order } from "@/lib/models/Order"

export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

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
  if (customerEmail) {
    query.requestedByEmail = new RegExp(`^${customerEmail.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
  }
  if (status) query.status = status
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
        ...a.toObject(),
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
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

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
    createdBy: user._id,
  })
  return NextResponse.json({ appointment }, { status: 201 })
})
