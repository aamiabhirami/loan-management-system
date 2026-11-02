import mongoose from "mongoose";
import {
  apiFailure,
  jsonError,
  numberField,
  optionalStringField,
  readJson,
  stringField,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { toPaise } from "@/lib/loan-workflow";
import { dateField } from "@/lib/payroll";
import { isOrganizationAdmin } from "@/lib/roles";
import { storageReferenceField } from "@/lib/storage-reference";
import Expense from "@/models/Expense";

export async function GET() {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("You do not have permission to view business expenses.", 403);
  await dbConnect();
  const expenses = await Expense.find({})
    .populate("createdBy", "name")
    .sort({ incurredAt: -1, createdAt: -1 })
    .lean();
  return Response.json({ expenses });
}

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("You do not have permission to record business expenses.", 403);

  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  try {
    const category = stringField(value.category, "Category", 80);
    const amountPaise = toPaise(numberField(value.amountRupees, "Amount", 0.01, 100_000_000));
    const incurredAt = dateField(value.incurredAt, "Expense date");
    const payee = stringField(value.payee, "Payee", 120);
    const notes = optionalStringField(value.notes, "Notes", 1000);
    const receiptStorageRef = value.receiptStorageRef
      ? storageReferenceField(value.receiptStorageRef, "Receipt storage reference")
      : undefined;

    await dbConnect();
    const session = await mongoose.startSession();
    let expenseId = "";
    try {
      await session.withTransaction(async () => {
        const [expense] = await Expense.create([{
          category,
          amountPaise,
          incurredAt,
          payee,
          notes,
          receiptStorageRef,
          createdBy: actor.id,
        }], { session });
        expenseId = expense._id.toString();
        await recordAudit({
          actorId: actor.id,
          action: "EXPENSE_CREATED",
          targetEntity: "Expense",
          entityId: expenseId,
          metadata: { amountPaise, category },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ expenseId }, { status: 201 });
  } catch (caught) {
    return apiFailure(caught);
  }
}
