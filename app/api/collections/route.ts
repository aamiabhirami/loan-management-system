import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import {
  apiFailure,
  jsonError,
  objectIdField,
  numberField,
  readJson,
  stringField,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { canAccessBorrower, getAccessibleBorrowerIds, requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { calculateLatePenalty } from "@/lib/finance";
import { toPaise } from "@/lib/loan-workflow";
import { outstandingProcessingFeePaise } from "@/lib/processing-fee";
import { sendCollectionReceipt } from "@/lib/providers/notifications";
import Collection from "@/models/Collection";
import Loan, { type IInstallment } from "@/models/Loan";
import LoanProduct from "@/models/LoanProduct";
import User from "@/models/User";

const channels = ["CASH", "UPI", "BANK_TRANSFER"] as const;

export async function GET() {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  await dbConnect();
  const borrowerIds = await getAccessibleBorrowerIds(actor);
  const filter = borrowerIds ? { borrower: { $in: borrowerIds } } : {};
  const collections = await Collection.find(filter)
    .populate("borrower", "name")
    .populate("collectedBy", "name")
    .populate("loan", "status")
    .sort({ collectedAt: -1 })
    .limit(100)
    .lean();
  return Response.json({ collections });
}

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("Only field managers and administrators can record field collections.", 403);
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");

  try {
    const loanId = objectIdField(value.loanId, "Loan");
    const amountPaise = toPaise(numberField(value.amountRupees, "Collection amount", 0.01, 100_000_000));
    if (typeof value.channel !== "string" || !channels.includes(value.channel as (typeof channels)[number])) {
      throw new TypeError("Choose cash, UPI, or bank transfer as the collection channel.");
    }
    const channel = value.channel as (typeof channels)[number];
    const collectionType = value.collectionType === undefined || value.collectionType === "INSTALLMENT"
      ? "INSTALLMENT"
      : value.collectionType === "PROCESSING_FEE" ? "PROCESSING_FEE" : null;
    if (!collectionType) throw new TypeError("Choose installment or processing fee as the collection type.");
    const idempotencyKey = stringField(value.idempotencyKey, "Idempotency key", 100);
    const reference = typeof value.reference === "string" ? value.reference.trim().slice(0, 80) : undefined;

    await dbConnect();
    const duplicate = await Collection.findOne({ idempotencyKey }).lean();
    if (duplicate) {
      if (duplicate.loan.toString() !== loanId
        || duplicate.collectedBy.toString() !== actor.id
        || duplicate.amountPaise !== amountPaise
        || (duplicate.collectionType ?? "INSTALLMENT") !== collectionType) {
        return jsonError("This request key was already used for a different collection.", 409);
      }
      revalidatePath("/dashboard");
      return Response.json({ collection: duplicate, replayed: true });
    }

    const existingLoan = await Loan.findById(loanId);
    if (!existingLoan) return jsonError("Loan not found.", 404);
    if (!(await canAccessBorrower(actor, existingLoan.borrower.toString()))) {
      return jsonError("You cannot record collections for this borrower.", 403);
    }
    if (existingLoan.status !== "ACTIVE") return jsonError("Collections can be recorded only against active loans.", 409);

    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const penalties = new Map<number, number>();
    if (collectionType === "PROCESSING_FEE") {
      const feeBalancePaise = outstandingProcessingFeePaise(
        existingLoan.processingFeePaise,
        existingLoan.processingFeePaidPaise,
      );
      if (feeBalancePaise === 0) return jsonError("This loan has no outstanding processing fee.", 409);
      if (amountPaise !== feeBalancePaise) return jsonError("Collect the full outstanding processing fee in one payment.", 400);
    } else {
      const product = await LoanProduct.findById(existingLoan.product).lean();
      if (!product) return jsonError("Loan product settings are unavailable.", 409);
      const openInstallments = (existingLoan.schedule as IInstallment[])
        .filter((installment) => installment.status !== "PAID" && installment.dueDate.getTime() <= today)
        .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());
      if (openInstallments.length === 0) return jsonError("There are no installments due for collection.", 409);

      let duePaise = 0;
      for (const installment of openInstallments) {
        const outstandingBase = installment.principalDuePaise - installment.principalPaidPaise
          + installment.interestDuePaise - installment.interestPaidPaise;
        const daysPastDue = Math.max(0, Math.floor((today - Date.UTC(
          installment.dueDate.getUTCFullYear(),
          installment.dueDate.getUTCMonth(),
          installment.dueDate.getUTCDate(),
        )) / 86_400_000));
        const penalty = Math.max(
          installment.penaltyAssessedPaise,
          calculateLatePenalty({
            overdueAmountPaise: outstandingBase,
            daysPastDue,
            graceDays: product.graceDays,
            fixedFeePaise: product.fixedLateFeePaise,
            annualRatePercent: product.penaltyAnnualRatePercent,
            capPaise: product.penaltyCapPaise,
            dayCountBasis: product.dayCountBasis,
          }),
        );
        penalties.set(installment.installmentNo, penalty);
        duePaise += outstandingBase + penalty - installment.penaltyPaidPaise;
      }
      if (amountPaise > duePaise) {
        return jsonError("Collection cannot exceed due installments and assessed penalties.", 400);
      }
    }

    const session = await mongoose.startSession();
    let collectionId = "";
    let receiptCode = "";
    try {
      await session.withTransaction(async () => {
        const loan = await Loan.findById(loanId).session(session);
        if (!loan || loan.status !== "ACTIVE") throw new TypeError("Loan status changed; refresh and retry.");
        const allocations: {
          installmentNo: number;
          principalPaise: number;
          interestPaise: number;
          penaltyPaise: number;
        }[] = [];

        if (collectionType === "PROCESSING_FEE") {
          const feeBalancePaise = outstandingProcessingFeePaise(
            loan.processingFeePaise,
            loan.processingFeePaidPaise,
          );
          if (feeBalancePaise === 0 || amountPaise !== feeBalancePaise) {
            throw new TypeError("Processing fee balance changed; refresh and retry.");
          }
          loan.processingFeePaidPaise = (loan.processingFeePaidPaise ?? 0) + amountPaise;
        } else {
          let remainingPaise = amountPaise;
          for (const installment of loan.schedule as IInstallment[]) {
            if (remainingPaise === 0 || installment.status === "PAID" || installment.dueDate.getTime() > today) continue;
            const assessedPenalty = penalties.get(installment.installmentNo) ?? installment.penaltyAssessedPaise;
            installment.penaltyAssessedPaise = assessedPenalty;

            const penaltyPaise = Math.min(remainingPaise, assessedPenalty - installment.penaltyPaidPaise);
            installment.penaltyPaidPaise += penaltyPaise;
            remainingPaise -= penaltyPaise;

            const interestPaise = Math.min(
              remainingPaise,
              installment.interestDuePaise - installment.interestPaidPaise,
            );
            installment.interestPaidPaise += interestPaise;
            remainingPaise -= interestPaise;

            const principalPaise = Math.min(
              remainingPaise,
              installment.principalDuePaise - installment.principalPaidPaise,
            );
            installment.principalPaidPaise += principalPaise;
            remainingPaise -= principalPaise;
            installment.paidPaise = installment.penaltyPaidPaise
              + installment.interestPaidPaise
              + installment.principalPaidPaise;
            installment.status = installment.paidPaise
              >= installment.totalDuePaise + installment.penaltyAssessedPaise
              ? "PAID"
              : "PENDING";

            allocations.push({
              installmentNo: installment.installmentNo,
              principalPaise,
              interestPaise,
              penaltyPaise,
            });
          }
          if (remainingPaise > 0) throw new TypeError("The collection could not be fully allocated; refresh and retry.");
        }
        const installmentsPaid = loan.schedule.length > 0
          && (loan.schedule as IInstallment[]).every((installment) => installment.status === "PAID");
        const processingFeePaid = outstandingProcessingFeePaise(
          loan.processingFeePaise,
          loan.processingFeePaidPaise,
        ) === 0;
        if (installmentsPaid && processingFeePaid) loan.status = "CLOSED";
        await loan.save({ session });

        receiptCode = `RCPT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const [collection] = await Collection.create([{
          loan: loan._id,
          borrower: loan.borrower,
          collectedBy: actor.id,
          idempotencyKey,
          receiptCode,
          collectionType,
          amountPaise,
          channel,
          reference,
          allocations,
          status: "RECORDED",
          isSandbox: false,
          collectedAt: now,
        }], { session });
        collectionId = collection._id.toString();
        await recordAudit({
          actorId: actor.id,
          action: collectionType === "PROCESSING_FEE" ? "PROCESSING_FEE_COLLECTED" : "COLLECTION_RECORDED",
          targetEntity: "Loan",
          entityId: loan._id.toString(),
          metadata: { amountPaise, channel, collectionType, receiptCode },
        }, session);
      });
    } finally {
      await session.endSession();
    }

    revalidatePath("/dashboard");
    const borrower = await User.findById(existingLoan.borrower).select("phone").lean();
    const notification = await sendCollectionReceipt({ receiptCode, phone: borrower?.phone });
    return Response.json({
      collectionId,
      receiptCode,
      amountPaise,
      notification,
      message: "Collection recorded. The notification adapter is running in sandbox mode.",
    }, { status: 201 });
  } catch (caught) {
    return apiFailure(caught);
  }
}
