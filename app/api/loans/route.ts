import mongoose from "mongoose";
import {
  apiFailure,
  jsonError,
  objectIdField,
  numberField,
  readJson,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { canAccessBorrower, getAccessibleBorrowerIds, requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { generateAmortizationSchedule } from "@/lib/finance";
import { evaluateDebtToIncome, installmentCount, monthlyEquivalentPaise, toPaise } from "@/lib/loan-workflow";
import "@/models/CreditCheck";
import Group from "@/models/Group";
import Loan, { type IInstallment } from "@/models/Loan";
import LoanProduct from "@/models/LoanProduct";

export async function GET() {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  await dbConnect();
  const borrowerIds = await getAccessibleBorrowerIds(actor);
  const filter = borrowerIds ? { borrower: { $in: borrowerIds } } : {};
  console.log("filter ==> ", filter);
  const loans = await Loan.find(filter)
  .populate("borrower", "name email phone")
  .populate("product", "name code")
  .populate("assignedOfficer", "name")
  .populate("creditCheck", "provider status checkedAt consentedAt decisionEligible")
  .sort({ createdAt: -1 })
  .lean();
  console.log("loans ==> ", loans);
  return Response.json({ loans, isProduction: process.env.NODE_ENV === "production" });
}

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");

  try {
    const borrowerId = actor.role === "user"
      ? actor.id
      : objectIdField(value.borrowerId, "Borrower");
    if (!(await canAccessBorrower(actor, borrowerId))) {
      return jsonError("You can create applications only for accounts in your scope.", 403);
    }
    const productId = objectIdField(value.productId, "Loan product");
    const principalPaise = toPaise(numberField(value.principalRupees, "Principal", 1, 100_000_000));
    const tenureMonths = numberField(value.tenureMonths, "Tenure", 1, 120);
    const householdMonthlyIncomePaise = toPaise(numberField(value.householdMonthlyIncomeRupees, "Monthly household income", 1, 100_000_000));
    const existingMonthlyDebtPaise = toPaise(numberField(value.existingMonthlyDebtRupees, "Existing monthly debt", 0, 100_000_000));
    if (!Number.isInteger(tenureMonths)) throw new TypeError("Tenure must use whole months.");

    await dbConnect();
    const product = await LoanProduct.findOne({ _id: productId, isActive: true }).lean();
    if (!product) return jsonError("The selected loan product is unavailable.", 404);
    if (principalPaise < product.minPrincipalPaise || principalPaise > product.maxPrincipalPaise) {
      throw new TypeError("Principal amount is outside this product's allowed range.");
    }
    if (tenureMonths < product.minTenureMonths || tenureMonths > product.maxTenureMonths) {
      throw new TypeError("Tenure is outside this product's allowed range.");
    }

    const existingLoans = await Loan.find({ borrower: borrowerId, status: "ACTIVE" })
      .select("schedule frequency")
      .lean();
    const existingAccountDebtServicePaise = existingLoans.reduce((sum, loan) => {
      const unpaidInstallments = (loan.schedule as IInstallment[])
        .filter((installment) => installment.status !== "PAID");
      if (unpaidInstallments.length === 0) return sum;
      const outstanding = unpaidInstallments.reduce(
        (amount, installment) => amount + Math.max(
          0,
          installment.principalDuePaise - installment.principalPaidPaise
            + installment.interestDuePaise - installment.interestPaidPaise,
        ),
        0,
      );
      return sum + monthlyEquivalentPaise(Math.ceil(outstanding / unpaidInstallments.length), loan.frequency);
    }, 0);
    const proposedSchedule = generateAmortizationSchedule({
      principalPaise,
      annualRatePercent: product.annualInterestRatePercent,
      installments: installmentCount(tenureMonths, product.frequency),
      frequency: product.frequency,
      dayCountBasis: product.dayCountBasis,
      startDate: new Date(),
      paymentWeekday: product.paymentWeekday,
      paymentMonthDate: product.paymentMonthDate,
    });
    const estimatedMonthlyInstallmentPaise = monthlyEquivalentPaise(
      proposedSchedule.installmentAmountPaise,
      product.frequency,
    );
    const estimatedMonthlyDebtServicePaise = existingMonthlyDebtPaise
      + existingAccountDebtServicePaise
      + estimatedMonthlyInstallmentPaise;
    const affordability = evaluateDebtToIncome({
      householdMonthlyIncomePaise,
      monthlyDebtServicePaise: estimatedMonthlyDebtServicePaise,
      maximumPercent: product.maxDebtToIncomePercent,
    });

    let groupId: string | undefined;
    if (value.groupId) {
      groupId = objectIdField(value.groupId, "Group");
      const group = await Group.findOne({ _id: groupId, isActive: true, members: borrowerId }).select("_id assignedOfficer");
      if (!group) throw new TypeError("The borrower is not a member of the selected active group.");
      if (actor.role === "privileged" && group.assignedOfficer.toString() !== actor.id) {
        return jsonError("This group is assigned to another field manager.", 403);
      }
    }

    const session = await mongoose.startSession();
    let loanId = "";
    try {
      await session.withTransaction(async () => {
        const [loan] = await Loan.create([{
          borrower: borrowerId,
          product: productId,
          group: groupId,
          requestedBy: actor.id,
          assignedOfficer: actor.role === "privileged" ? actor.id : undefined,
          principalPaise,
          annualInterestRatePercent: product.annualInterestRatePercent,
          householdMonthlyIncomePaise,
          existingMonthlyDebtPaise,
          estimatedMonthlyInstallmentPaise,
          estimatedMonthlyDebtServicePaise,
          debtToIncomePercent: affordability.percent,
          affordabilityPassed: affordability.passed,
          tenureMonths,
          frequency: product.frequency,
          paymentWeekday: product.paymentWeekday,
          paymentMonthDate: product.paymentMonthDate,
          dayCountBasis: product.dayCountBasis,
          status: "PENDING_APPROVAL",
          schedule: [],
        }], { session });
        loanId = loan._id.toString();
        await recordAudit({
          actorId: actor.id,
          action: "LOAN_APPLICATION_CREATED",
          targetEntity: "Loan",
          entityId: loanId,
          metadata: {
            principalPaise,
            productCode: product.code,
            debtToIncomePercent: affordability.percent,
            affordabilityPassed: affordability.passed,
          },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ id: loanId, status: "PENDING_APPROVAL" }, { status: 201 });
  } catch (caught) {
    return apiFailure(caught);
  }
}
