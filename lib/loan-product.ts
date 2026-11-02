import { numberField, optionalStringField, stringField } from "@/lib/api";
import type { DayCountBasis, RepaymentFrequency } from "@/lib/finance";

const frequencies: RepaymentFrequency[] = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"];
const dayCounts: DayCountBasis[] = ["ACTUAL_365", "ACTUAL_360"];

export function parseLoanProductInput(value: Record<string, unknown>) {
  const name = stringField(value.name, "Name", 100);
  const code = stringField(value.code, "Code", 24).toUpperCase();
  const minPrincipalPaise = Math.round(numberField(value.minPrincipalRupees, "Minimum principal", 1, 100_000_000) * 100);
  const maxPrincipalPaise = Math.round(numberField(value.maxPrincipalRupees, "Maximum principal", 1, 100_000_000) * 100);
  if (maxPrincipalPaise < minPrincipalPaise) throw new TypeError("Maximum principal must be at least the minimum.");
  const minTenureMonths = numberField(value.minTenureMonths, "Minimum tenure", 1, 120);
  const maxTenureMonths = numberField(value.maxTenureMonths, "Maximum tenure", 1, 120);
  if (!Number.isInteger(minTenureMonths) || !Number.isInteger(maxTenureMonths) || maxTenureMonths < minTenureMonths) {
    throw new TypeError("Tenure must use whole months and maximum tenure must be at least the minimum.");
  }
  if (typeof value.frequency !== "string" || !frequencies.includes(value.frequency as RepaymentFrequency)) {
    throw new TypeError("Choose a supported repayment frequency.");
  }
  const frequency = value.frequency as RepaymentFrequency;
  const paymentWeekday = frequency === "WEEKLY"
    ? numberField(value.paymentWeekday, "Payment weekday", 0, 6)
    : undefined;
  if (paymentWeekday !== undefined && !Number.isInteger(paymentWeekday)) {
    throw new TypeError("Choose a valid weekday.");
  }
  const paymentMonthDate = frequency === "MONTHLY"
    ? numberField(value.paymentMonthDate, "Payment date", 1, 31)
    : undefined;
  if (paymentMonthDate !== undefined && !Number.isInteger(paymentMonthDate)) {
    throw new TypeError("Choose a whole date from 1 to 31.");
  }
  if (typeof value.dayCountBasis !== "string" || !dayCounts.includes(value.dayCountBasis as DayCountBasis)) {
    throw new TypeError("Choose a supported day-count basis.");
  }
  const annualInterestRatePercent = numberField(value.annualInterestRatePercent, "Annual interest rate", 0, 100);
  const maxDebtToIncomePercent = value.maxDebtToIncomePercent === undefined
    ? 50
    : numberField(value.maxDebtToIncomePercent, "Maximum debt-to-income ratio", 1, 100);
  const graceDays = value.graceDays === undefined ? 0 : numberField(value.graceDays, "Grace days", 0, 90);
  const fixedLateFeePaise = value.fixedLateFeeRupees === undefined
    ? 0
    : Math.round(numberField(value.fixedLateFeeRupees, "Fixed late fee", 0, 1_000_000) * 100);
  const penaltyAnnualRatePercent = value.penaltyAnnualRatePercent === undefined
    ? 0
    : numberField(value.penaltyAnnualRatePercent, "Penalty interest rate", 0, 100);
  const penaltyCapPaise = value.penaltyCapRupees === undefined || value.penaltyCapRupees === ""
    ? undefined
    : Math.round(numberField(value.penaltyCapRupees, "Penalty cap", 0, 1_000_000) * 100);
  const description = optionalStringField(value.description, "Description", 500);

  return {
    name,
    code,
    description,
    minPrincipalPaise,
    maxPrincipalPaise,
    minTenureMonths,
    maxTenureMonths,
    annualInterestRatePercent,
    maxDebtToIncomePercent,
    frequency,
    paymentWeekday,
    paymentMonthDate,
    dayCountBasis: value.dayCountBasis as DayCountBasis,
    graceDays,
    fixedLateFeePaise,
    penaltyAnnualRatePercent,
    penaltyCapPaise,
  };
}
