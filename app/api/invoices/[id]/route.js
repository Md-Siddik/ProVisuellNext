import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { Invoice } from "@/lib/models/Invoice"
import { assertOwnInvoice } from "@/lib/invoicing"

export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  const invoice = await Invoice.findById(id)
  if (!invoice) throw new ApiError(404, "Invoice not found")
  assertOwnInvoice(user, invoice)
  return NextResponse.json({ invoice })
})
