import mongoose from "mongoose";
import { apiFailure, jsonError, objectIdField, readJson, stringField } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin } from "@/lib/roles";
import { generateAmortizationSchedule } from "@/lib/finance";
import { getLoanApprovalBlocker, installmentCount } from "@/lib/loan-workflow";
import { initiateDisbursement } from "@/lib/providers/disbursement";
import CreditCheck from "@/models/CreditCheck";
import Loan from "@/models/Loan";
import LoanProduct from "@/models/LoanProduct";

type RouteContext = { params: Promise<{ loanId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("Only organization administrators can approve or disburse loans.", 403);

  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  const action = value.action;
  if (action !== "approve" && action !== "approve_without_credit_check"
    && action !== "reject" && action !== "disburse") {
    return jsonError("Choose approve, approve_without_credit_check, reject, or disburse.");
  }

  try {
    await dbConnect();
    const { loanId: rawLoanId } = await params;
    const loanId = objectIdField(rawLoanId, "Loan");
    const loan = await Loan.findById(loanId);
    if (!loan) return jsonError("Loan application not found.", 404);
    const creditCheckOverrideReason = action === "approve_without_credit_check"
      ? stringField(value.reason, "Credit-check override reason", 500)
      : undefined;
    let disbursement: Awaited<ReturnType<typeof initiateDisbursement>> | undefined;
    let product: Awaited<ReturnType<typeof LoanProduct.findById>> = null;

    if (action === "approve" || action === "approve_without_credit_check") {
      if (loan.status !== "PENDING_APPROVAL") return jsonError("Only pending applications can be approved.", 409);
      const creditCheck = loan.creditCheck
        ? await CreditCheck.findById(loan.creditCheck).select("consentedAt status decisionEligible")
        : null;
      const approvalBlocker = getLoanApprovalBlocker({
        affordabilityPassed: loan.affordabilityPassed,
        creditCheck,
        isProduction: process.env.NODE_ENV === "production",
        bypassCreditCheck: action === "approve_without_credit_check",
      });
      if (approvalBlocker) return jsonError(approvalBlocker, 409);
    } else if (action === "reject") {
      if (loan.status !== "PENDING_APPROVAL") return jsonError("Only pending applications can be rejected.", 409);
      stringField(value.reason, "Rejection reason", 500);
    } else {
      if (loan.status !== "APPROVED") return jsonError("Only approved loans can be disbursed.", 409);
      if (process.env.NODE_ENV === "production") {
        return jsonError("Live disbursement is not configured. Sandbox disbursements are disabled in production.", 503);
      }
      product = await LoanProduct.findById(loan.product);
      if (!product) return jsonError("The loan product is unavailable.", 409);
      disbursement = await initiateDisbursement({
        loanId: loan._id.toString(),
        amountPaise: loan.principalPaise,
      });
    }

    const session = await mongoose.startSession();
    let resultStatus = "";
    try {
      await session.withTransaction(async () => {
        const freshLoan = await Loan.findById(loan._id).session(session);
        if (!freshLoan) throw new TypeError("Loan application no longer exists.");

        if (action === "approve" || action === "approve_without_credit_check") {
          if (freshLoan.status !== "PENDING_APPROVAL") throw new TypeError("Loan status changed; refresh and retry.");
          freshLoan.status = "APPROVED";
          freshLoan.approvedBy = new mongoose.Types.ObjectId(actor.id);
          freshLoan.approvedAt = new Date();
        } else if (action === "reject") {
          if (freshLoan.status !== "PENDING_APPROVAL") throw new TypeError("Loan status changed; refresh and retry.");
          freshLoan.status = "REJECTED";
          freshLoan.rejectionReason = stringField(value.reason, "Rejection reason", 500);
        } else {
          if (freshLoan.status !== "APPROVED" || !product || !disbursement) {
            throw new TypeError("Loan status changed; refresh and retry.");
          }
          const schedule = generateAmortizationSchedule({
            principalPaise: freshLoan.principalPaise,
            annualRatePercent: freshLoan.annualInterestRatePercent,
            installments: installmentCount(freshLoan.tenureMonths, freshLoan.frequency),
            frequency: freshLoan.frequency,
            dayCountBasis: freshLoan.dayCountBasis,
            startDate: new Date(),
            paymentWeekday: freshLoan.paymentWeekday,
            paymentMonthDate: freshLoan.paymentMonthDate,
          });
          freshLoan.schedule = schedule.schedule;
          freshLoan.status = "ACTIVE";
          freshLoan.disbursementMode = disbursement.mode;
          freshLoan.disbursedAt = new Date();
        }

        await freshLoan.save({ session });
        resultStatus = freshLoan.status;
        await recordAudit({
          actorId: actor.id,
          action: action === "approve_without_credit_check"
            ? "LOAN_APPROVE_WITHOUT_CREDIT_CHECK"
            : `LOAN_${action.toUpperCase()}${disbursement ? "_SANDBOX" : ""}`,
          targetEntity: "Loan",
          entityId: freshLoan._id.toString(),
          metadata: {
            status: freshLoan.status,
            ...(action === "reject" ? { reason: freshLoan.rejectionReason ?? "" } : {}),
            ...(creditCheckOverrideReason ? { creditCheckOverrideReason } : {}),
            ...(disbursement ? { disbursementReference: disbursement.reference } : {}),
          },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({
      id: loan._id,
      status: resultStatus,
      ...(disbursement ? {
        disbursementMode: disbursement.mode,
        reference: disbursement.reference,
        message: "Sandbox disbursement recorded; no funds were transferred.",
      } : {}),
    });
  } catch (caught) {
    return apiFailure(caught);
  }
}
