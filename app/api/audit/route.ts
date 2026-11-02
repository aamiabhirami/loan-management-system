import { jsonError } from "@/lib/api";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin } from "@/lib/roles";
import AuditLog from "@/models/AuditLog";

export async function GET() {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("Only organization administrators can view the audit trail.", 403);

  await dbConnect();
  const events = await AuditLog.find({})
    .populate("actor", "name email role")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return Response.json({ events });
}
