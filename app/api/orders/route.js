import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors, ApiError } from "@/lib/auth"
import { Order } from "@/lib/models/Order"
import { User } from "@/lib/models/User"
import { Appointment } from "@/lib/models/Appointment"
import { Invoice } from "@/lib/models/Invoice"
import { notifyRole } from "@/lib/notify"
import { buildItemTotals, nextOrderNumber, notifyOrderCreated } from "@/lib/orderHelpers"

// List orders. Admin/owner see everything (optionally filtered); a plain
// customer only ever sees their own.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)

  const params = new URL(request.url).searchParams
  const status = params.get("status")
  const search = params.get("search")
  const page = Number(params.get("page") || 1)
  const limit = Number(params.get("limit") || 10)
  const deliveryFrom = params.get("deliveryFrom")
  const deliveryTo = params.get("deliveryTo")

  const query = {}
  if (user.role === "customer") {
    query.customerId = user._id
  }
  if (status && status !== "all") query.status = status

  const andClauses = []
  // Used by the Avtaler calendar to show orders relevant to the visible
  // week alongside booked appointments. A waiting order usually has no
  // expectedDeliveryDate yet — fall back to when it was placed so it still
  // shows up (on the calendar and in Rapporter drill-downs) instead of
  // disappearing until someone sets a delivery date.
  if (deliveryFrom || deliveryTo) {
    const from = deliveryFrom ? new Date(deliveryFrom) : new Date(0)
    const to = deliveryTo ? new Date(deliveryTo) : new Date(8640000000000000)
    andClauses.push({
      $or: [
        { expectedDeliveryDate: { $gte: from, $lte: to } },
        { expectedDeliveryDate: null, createdAt: { $gte: from, $lte: to } },
      ],
    })
  }
  if (search) {
    andClauses.push({
      $or: [
        { orderNumber: new RegExp(search, "i") },
        { customerName: new RegExp(search, "i") },
        { service: new RegExp(search, "i") },
      ],
    })
  }
  if (andClauses.length) query.$and = andClauses

  const skip = (page - 1) * limit
  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(query),
  ])

  // Attach a lightweight invoice summary per order (if one exists) so the
  // UI can show "Vis faktura" vs "Opprett faktura" without a round-trip per row.
  const orderIds = orders.map((o) => o._id)
  const invoices = await Invoice.find({ orderId: { $in: orderIds } }).select("orderId invoiceNumber status")
  const invoiceByOrder = new Map(invoices.map((i) => [String(i.orderId), i]))

  return NextResponse.json({
    orders: orders.map((o) => {
      const inv = invoiceByOrder.get(String(o._id))
      return {
        ...o.toObject(),
        invoice: inv ? { _id: inv._id, invoiceNumber: inv.invoiceNumber, status: inv.status } : null,
      }
    }),
    total,
    page,
    limit,
  })
})

export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  const {
    customerName,
    customerEmail,
    service,
    specification,
    amount,
    items,
    discount,
    expectedDeliveryDate,
    internalNote,
    attachments,
    source,
    appointmentId,
  } = (await request.json().catch(() => ({}))) || {}
  if (!customerName || !customerEmail || !service || !specification) {
    throw new ApiError(400, "customerName, customerEmail, service and specification are required")
  }

  // If the admin knows the customer's account email, link the order to it
  // so it shows up under that customer's "Mine bestillinger".
  let customerId = null
  if (customerEmail) {
    const match = await User.findOne({ email: customerEmail.trim().toLowerCase() })
    if (match) customerId = match._id
  }

  // If this order was registered off the back of a booked meeting, link it
  // so approving/rejecting it can also resolve that appointment.
  let linkedAppointment = null
  if (appointmentId) {
    linkedAppointment = await Appointment.findById(appointmentId)
    if (!linkedAppointment) throw new ApiError(400, "Appointment not found")
  }

  // Itemized service breakdown is optional — an order without any items
  // behaves exactly as before, using the manually entered `amount`.
  const { items: cleanItems, subtotal: itemsSubtotal, vatAmount: itemsVat } = buildItemTotals(items)
  const discountAmount = Math.max(0, Number(discount) || 0)
  const hasItems = cleanItems.length > 0
  const grandTotal = hasItems ? Math.max(0, itemsSubtotal - discountAmount) + itemsVat : Number(amount) || 0

  const order = await Order.create({
    orderNumber: await nextOrderNumber(),
    customerName,
    customerEmail: customerEmail || "",
    customerId,
    appointmentId: linkedAppointment?._id || null,
    service,
    specification,
    items: cleanItems,
    discount: hasItems ? discountAmount : 0,
    subtotal: hasItems ? itemsSubtotal : grandTotal,
    vatAmount: hasItems ? itemsVat : 0,
    grandTotal,
    amount: grandTotal,
    expectedDeliveryDate: expectedDeliveryDate || null,
    internalNote: internalNote || "",
    attachments: attachments || [],
    source: source || (linkedAppointment ? "meeting" : "admin"),
    createdBy: user._id,
  })

  // An administrator registering an order needs the owner to approve it —
  // if the owner registered it themselves, they already know.
  if (user.role !== "owner") {
    notifyRole("owner", {
      type: "order_created",
      title: "Ny ordre venter på godkjenning",
      message: `${order.customerName} — ${order.service}`,
      link: "/dashboard/owner/ordreoversikt",
    })
  }

  notifyOrderCreated(order)

  return NextResponse.json({ order }, { status: 201 })
})
