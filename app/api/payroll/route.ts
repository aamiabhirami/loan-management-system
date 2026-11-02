import mongoose from "mongoose";
import {
  apiFailure,
  jsonError,
  objectIdField,
  optionalStringField,
  readJson,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { toPaise } from "@/lib/loan-workflow";
import { calculatePayroll, dateField, monthRange, parsePayComponents } from "@/lib/payroll";
import { isOrganizationAdmin } from "@/lib/roles";
import PayrollRecord from "@/models/PayrollRecord";
import User from "@/models/User";

export async function GET(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("You do not have permission to view payroll.", 403);

  try {
    const { month, start, end } = monthRange(new URL(request.url).searchParams.get("month"));
    await dbConnect();
    const records = await PayrollRecord.find({ periodStart: { $gte: start, $lt: end } })
      .populate("employee", "name role")
      .populate("createdBy", "name")
      .sort({ periodStart: -1, createdAt: -1 })
      .lean();
    const totals = records.reduce((result, record) => {
      result.grossPaise += record.grossPaise;
      result.deductionsPaise += record.deductionsPaise;
      result.netPaise += record.netPaise;
      if (record.status === "PAID") result.paidPaise += record.netPaise;
      else result.draftPaise += record.netPaise;
      return result;
    }, { grossPaise: 0, deductionsPaise: 0, netPaise: 0, paidPaise: 0, draftPaise: 0 });
    return Response.json({ month, records, totals });
  } catch (caught) {
    return apiFailure(caught);
  }
}

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("You do not have permission to create payroll records.", 403);

  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  try {
    const employeeId = objectIdField(value.employeeId, "Employee");
    const periodStart = dateField(value.periodStart, "Pay period start");
    const periodEnd = dateField(value.periodEnd, "Pay period end");
    if (periodStart > periodEnd) throw new TypeError("Pay period end must be on or after its start date.");
    const earnings = parsePayComponents(value.earnings, "Earnings")
      .map(({ label, amountRupees }) => ({ label, amountPaise: toPaise(amountRupees) }));
    const deductions = parsePayComponents(value.deductions ?? [], "Deductions")
      .map(({ label, amountRupees }) => ({ label, amountPaise: toPaise(amountRupees) }));
    const totals = calculatePayroll(earnings, deductions);
    const notes = optionalStringField(value.notes, "Notes", 1000);

    await dbConnect();
    const employee = await User.findOne({
      _id: employeeId,
      role: { $in: ["director", "privileged"] },
      isActive: true,
    }).select("_id name role");
    if (!employee) throw new TypeError("Payroll can be assigned only to an active director or field manager/collection agent.");

    const session = await mongoose.startSession();
    let payrollId = "";
    try {
      await session.withTransaction(async () => {
        const [record] = await PayrollRecord.create([{
          employee: employeeId,
          periodStart,
          periodEnd,
          earnings,
          deductions,
          ...totals,
          status: "DRAFT",
          notes,
          createdBy: actor.id,
        }], { session });
        payrollId = record._id.toString();
        await recordAudit({
          actorId: actor.id,
          action: "PAYROLL_CREATED",
          targetEntity: "PayrollRecord",
          entityId: payrollId,
          metadata: { netPaise: totals.netPaise, status: "DRAFT" },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ payrollId }, { status: 201 });
  } catch (caught) {
    return apiFailure(caught);
  }
}
