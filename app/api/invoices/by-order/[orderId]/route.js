import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { Invoice } from "@/lib/models/Invoice"
import { assertOwnInvoice } from "@/lib/invoicing"

// Lets the UI show "Vis faktura" instead of "Opprett faktura" once one
// exists for an order, without a full invoice list round-trip.
export const GET = withApiErrors(async (request, { params }) => {
  const { orderId } = await params
  const { user } = await authenticate(request)
  const invoice = await Invoice.findOne({ orderId }).sort({ createdAt: -1 })
  if (!invoice) return NextResponse.json({ invoice: null })
  assertOwnInvoice(user, invoice)
  return NextResponse.json({ invoice })
})
