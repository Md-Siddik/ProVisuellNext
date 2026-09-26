import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requireSuperAdmin } from "@/lib/access"
import { AuditLog } from "@/lib/models/AuditLog"

const PAGE_SIZE = 50

// Super Admin only: the role/permission audit trail, newest first.
export const GET = withApiErrors(async (request) => {
  requireSuperAdmin(await authenticate(request))
  const sp = new URL(request.url).searchParams
  const page = Math.max(1, Math.min(1000, Number(sp.get("page")) || 1))
  const target = sp.get("target")
  const query = target && mongoose.isValidObjectId(target) ? { target } : {}
  const [entries, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    AuditLog.countDocuments(query),
  ])
  return NextResponse.json({ entries, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
})
