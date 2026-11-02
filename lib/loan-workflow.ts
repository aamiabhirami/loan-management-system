import type { RepaymentFrequency } from "@/lib/finance";

export type ApprovalCreditCheck = {
  status: "SANDBOX" | "COMPLETED" | "FAILED";
  consentedAt?: Date | string | null;
  decisionEligible: boolean;
};

export function getLoanApprovalBlocker(input: {
  affordabilityPassed: boolean;
  creditCheck?: ApprovalCreditCheck | null;
  isProduction: boolean;
  bypassCreditCheck?: boolean;
}) {
  if (!input.affordabilityPassed) {
    return "The application exceeds the loan product's configured debt-to-income limit.";
  }
  if (input.bypassCreditCheck) return null;
  if (!input.creditCheck) {
    return "Awaiting borrower consent and credit check. The borrower must sign in and submit consent.";
  }
  if (!input.creditCheck.consentedAt) {
    return "Credit consent could not be verified.";
  }
  if (input.creditCheck.status === "FAILED") {
    return "The credit check failed and cannot support approval.";
  }
  if (input.creditCheck.status === "SANDBOX" && input.isProduction) {
    return "A sandbox credit check cannot be used for approval in production.";
  }
  if (input.creditCheck.status === "COMPLETED" && !input.creditCheck.decisionEligible) {
    return "This credit check is not eligible to support a loan decision.";
  }
  return null;
}

export function installmentCount(tenureMonths: number, frequency: RepaymentFrequency) {
  if (frequency === "WEEKLY") return Math.round(tenureMonths / 12 * 52);
  if (frequency === "FORTNIGHTLY") return Math.round(tenureMonths / 12 * 26);
  return tenureMonths;
}

export function toPaise(rupees: number) {
  const paise = Math.round(rupees * 100);
  if (!Number.isSafeInteger(paise)) throw new RangeError("Amount exceeds the supported currency limit.");
  return paise;
}

export function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function monthlyEquivalentPaise(amountPaise: number, frequency: RepaymentFrequency) {
  const periodsPerYear = frequency === "WEEKLY" ? 52 : frequency === "FORTNIGHTLY" ? 26 : 12;
  return Math.round(amountPaise * periodsPerYear / 12);
}

export function evaluateDebtToIncome(input: {
  householdMonthlyIncomePaise: number;
  monthlyDebtServicePaise: number;
  maximumPercent: number;
}) {
  if (!Number.isSafeInteger(input.householdMonthlyIncomePaise) || input.householdMonthlyIncomePaise <= 0) {
    throw new RangeError("Household monthly income must be a positive amount in paise.");
  }
  if (!Number.isSafeInteger(input.monthlyDebtServicePaise) || input.monthlyDebtServicePaise < 0) {
    throw new RangeError("Monthly debt service must be a non-negative amount in paise.");
  }
  if (!Number.isFinite(input.maximumPercent) || input.maximumPercent <= 0 || input.maximumPercent > 100) {
    throw new RangeError("Maximum debt-to-income ratio must be between 0 and 100 percent.");
  }

  const percent = input.monthlyDebtServicePaise / input.householdMonthlyIncomePaise * 100;
  return { percent, passed: percent <= input.maximumPercent };
}
