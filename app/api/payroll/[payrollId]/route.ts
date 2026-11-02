import mongoose from "mongoose";
import { apiFailure, jsonError, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { dateField } from "@/lib/payroll";
import { isOrganizationAdmin } from "@/lib/roles";
import PayrollRecord from "@/models/PayrollRecord";

type RouteContext = { params: Promise<{ payrollId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("You do not have permission to update payroll.", 403);
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  if (value.status !== "PAID") return jsonError("Payroll status can only be changed to paid.");

  try {
    const { payrollId } = await params;
    if (!mongoose.isValidObjectId(payrollId)) return jsonError("Payroll record identifier is invalid.");
    const paidAt = value.paidAt === undefined
      ? new Date()
      : dateField(value.paidAt, "Payment date");
    await dbConnect();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const record = await PayrollRecord.findById(payrollId).session(session);
        if (!record) throw new TypeError("Payroll record not found.");
        if (record.status !== "DRAFT") throw new TypeError("Only draft payroll records can be marked as paid.");
        record.status = "PAID";
        record.paidAt = paidAt;
        await record.save({ session });
        await recordAudit({
          actorId: actor.id,
          action: "PAYROLL_MARKED_PAID",
          targetEntity: "PayrollRecord",
          entityId: payrollId,
          metadata: { netPaise: record.netPaise, status: record.status },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ message: "Payroll marked as paid." });
  } catch (caught) {
    return apiFailure(caught);
  }
}
