import assert from "node:assert/strict";
import test from "node:test";
import { calculateLatePenalty, generateAmortizationSchedule } from "../lib/finance.ts";
import { evaluateDebtToIncome, monthlyEquivalentPaise } from "../lib/loan-workflow.ts";

const baseSchedule = {
  principalPaise: 1_000_000,
  annualRatePercent: 24,
  installments: 12,
  frequency: "MONTHLY",
  dayCountBasis: "ACTUAL_365",
  startDate: new Date("2026-01-31T12:00:00.000Z"),
};

test("monthly reducing-balance schedule amortizes principal and preserves calendar dates", () => {
  const result = generateAmortizationSchedule(baseSchedule);

  assert.equal(result.schedule.length, 12);
  assert.equal(result.schedule[0].dueDate.toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(result.schedule[1].dueDate.toISOString(), "2026-03-31T00:00:00.000Z");
  assert.equal(result.schedule.at(-1).dueDate.toISOString(), "2027-01-31T00:00:00.000Z");
  assert.equal(result.schedule.reduce((sum, installment) => sum + installment.principalDuePaise, 0), baseSchedule.principalPaise);
  assert.ok(result.totalInterestPaise > 0);
  assert.equal(result.totalPayablePaise, result.totalInterestPaise + baseSchedule.principalPaise);
  assert.ok(result.schedule.every((installment) => installment.totalDuePaise === installment.principalDuePaise + installment.interestDuePaise));
});

test("zero-interest schedules avoid division by zero and sum exactly to principal", () => {
  const result = generateAmortizationSchedule({ ...baseSchedule, annualRatePercent: 0, installments: 7 });

  assert.equal(result.totalInterestPaise, 0);
  assert.equal(result.totalPayablePaise, baseSchedule.principalPaise);
  assert.equal(result.schedule.reduce((sum, installment) => sum + installment.principalDuePaise, 0), baseSchedule.principalPaise);
});

test("weekly and fortnightly repayment cadences produce the requested number of installments", () => {
  const weekly = generateAmortizationSchedule({ ...baseSchedule, installments: 52, frequency: "WEEKLY" });
  const fortnightly = generateAmortizationSchedule({ ...baseSchedule, installments: 26, frequency: "FORTNIGHTLY" });

  assert.equal(weekly.schedule.length, 52);
  assert.equal(fortnightly.schedule.length, 26);
  assert.equal(weekly.schedule[0].dueDate.getTime() - Date.UTC(2026, 0, 31), 7 * 86_400_000);
  assert.equal(fortnightly.schedule[0].dueDate.getTime() - Date.UTC(2026, 0, 31), 14 * 86_400_000);
});

test("weekly schedules use the selected weekday for every installment", () => {
  const result = generateAmortizationSchedule({
    ...baseSchedule,
    frequency: "WEEKLY",
    installments: 3,
    paymentWeekday: 2,
  });

  assert.deepEqual(result.schedule.map((item) => item.dueDate.toISOString()), [
    "2026-02-03T00:00:00.000Z",
    "2026-02-10T00:00:00.000Z",
    "2026-02-17T00:00:00.000Z",
  ]);
});

test("monthly schedules use the selected date and clamp short months", () => {
  const result = generateAmortizationSchedule({
    ...baseSchedule,
    installments: 4,
    paymentMonthDate: 31,
  });

  assert.deepEqual(result.schedule.map((item) => item.dueDate.toISOString()), [
    "2026-02-28T00:00:00.000Z",
    "2026-03-31T00:00:00.000Z",
    "2026-04-30T00:00:00.000Z",
    "2026-05-31T00:00:00.000Z",
  ]);
});

test("actual/360 accrues more interest than actual/365 for identical terms", () => {
  const actual365 = generateAmortizationSchedule(baseSchedule);
  const actual360 = generateAmortizationSchedule({ ...baseSchedule, dayCountBasis: "ACTUAL_360" });

  assert.ok(actual360.totalInterestPaise > actual365.totalInterestPaise);
});

test("late fees respect grace periods and configured caps", () => {
  const input = {
    overdueAmountPaise: 100_000,
    daysPastDue: 10,
    graceDays: 10,
    fixedFeePaise: 500,
    annualRatePercent: 36,
    dayCountBasis: "ACTUAL_365",
  };

  assert.equal(calculateLatePenalty(input), 0);
  assert.equal(calculateLatePenalty({ ...input, daysPastDue: 11 }), 599);
  assert.equal(calculateLatePenalty({ ...input, daysPastDue: 365, capPaise: 800 }), 800);
});

test("invalid monetary amounts and installment counts are rejected", () => {
  assert.throws(() => generateAmortizationSchedule({ ...baseSchedule, principalPaise: 0 }), RangeError);
  assert.throws(() => generateAmortizationSchedule({ ...baseSchedule, installments: 0 }), RangeError);
  assert.throws(() => generateAmortizationSchedule({ ...baseSchedule, annualRatePercent: -1 }), RangeError);
  assert.throws(() => generateAmortizationSchedule({ ...baseSchedule, frequency: "DAILY" }), RangeError);
  assert.throws(() => generateAmortizationSchedule({ ...baseSchedule, dayCountBasis: "30_360" }), RangeError);
  assert.throws(() => calculateLatePenalty({
    overdueAmountPaise: -1,
    daysPastDue: 3,
    graceDays: 0,
    fixedFeePaise: 0,
    annualRatePercent: 0,
    dayCountBasis: "ACTUAL_365",
  }), RangeError);
});

test("affordability includes monthly debt service and honors the configured product limit", () => {
  const result = evaluateDebtToIncome({
    householdMonthlyIncomePaise: 500_000,
    monthlyDebtServicePaise: 250_000,
    maximumPercent: 50,
  });
  assert.deepEqual(result, { percent: 50, passed: true });
  assert.equal(evaluateDebtToIncome({
    householdMonthlyIncomePaise: 500_000,
    monthlyDebtServicePaise: 250_001,
    maximumPercent: 50,
  }).passed, false);
});

test("weekly obligations are normalized to monthly debt service", () => {
  assert.equal(monthlyEquivalentPaise(1_000, "WEEKLY"), 4_333);
  assert.equal(monthlyEquivalentPaise(1_000, "FORTNIGHTLY"), 2_167);
  assert.equal(monthlyEquivalentPaise(1_000, "MONTHLY"), 1_000);
});
