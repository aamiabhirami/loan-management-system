import mongoose from "mongoose";
import { apiFailure, jsonError, objectIdField, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { sandboxCreditBureau } from "@/lib/providers/credit-bureau";
import CreditCheck from "@/models/CreditCheck";
import Loan from "@/models/Loan";
import User from "@/models/User";

type RouteContext = { params: Promise<{ loanId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  if (value.consent !== true) return jsonError("Explicit credit bureau consent is required.");

  try {
    await dbConnect();
    const { loanId: rawLoanId } = await params;
    const loanId = objectIdField(rawLoanId, "Loan");
    const loan = await Loan.findById(loanId);
    if (!loan) return jsonError("Loan application not found.", 404);
    if (actor.id !== loan.borrower.toString()) {
      return jsonError("Only the borrower can provide credit bureau consent.", 403);
    }
    if (loan.status !== "PENDING_APPROVAL") {
      return jsonError("Credit checks are available only for pending applications.", 409);
    }
    if (loan.creditCheck) return jsonError("A credit inquiry has already been recorded for this application.", 409);

    const consentedAt = new Date();
    const result = await sandboxCreditBureau.check({
      borrowerId: loan.borrower.toString(),
      loanId: loan._id.toString(),
      consentedAt,
    });
    const session = await mongoose.startSession();
    let checkId = "";
    try {
      await session.withTransaction(async () => {
        const borrower = await User.findById(loan.borrower).session(session);
        const freshLoan = await Loan.findById(loan._id).session(session);
        if (!borrower || !freshLoan || freshLoan.status !== "PENDING_APPROVAL") {
          throw new TypeError("Loan application changed while the credit check was being recorded.");
        }
        const [check] = await CreditCheck.create([{
          borrower: borrower._id,
          loan: freshLoan._id,
          provider: result.provider,
          status: result.status,
          checkedAt: result.checkedAt,
          consentedAt,
          providerReference: result.reference,
          decisionEligible: result.decisionEligible,
        }], { session });
        borrower.creditConsentAt = consentedAt;
        await borrower.save({ session });
        freshLoan.creditCheck = check._id;
        await freshLoan.save({ session });
        checkId = check._id.toString();
        await recordAudit({
          actorId: actor.id,
          action: "CREDIT_CHECK_SANDBOX",
          targetEntity: "Loan",
          entityId: freshLoan._id.toString(),
          metadata: { provider: result.provider, decisionEligible: false },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({
      id: checkId,
      provider: result.provider,
      status: result.status,
      checkedAt: result.checkedAt,
      decisionEligible: result.decisionEligible,
      message: "Sandbox only. This is not a bureau report and cannot support a real credit decision.",
    }, { status: 201 });
  } catch (caught) {
    return apiFailure(caught);
  }
}
