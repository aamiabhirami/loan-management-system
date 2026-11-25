import assert from "node:assert/strict";
import test from "node:test";
import { getGroupRepaymentHealth } from "../lib/group-health.ts";

const asOf = new Date("2026-11-25T00:00:00.000Z");
const installment = (paidPaise, dueDate = "2026-11-01T00:00:00.000Z") => ({
  dueDate,
  totalDuePaise: 10_000,
  penaltyAssessedPaise: 0,
  paidPaise,
});
const activeLoan = (schedule) => ({ status: "ACTIVE", disbursedAt: asOf, schedule });

test("group health uses paid amounts against active-loan installments due to date", () => {
  const health = getGroupRepaymentHealth([
    activeLoan([
      installment(9_000),
      installment(10_000, "2026-12-01T00:00:00.000Z"),
    ]),
  ], asOf);

  assert.equal(health.status, "HEALTHY");
  assert.equal(health.repaymentPercent, 90);
  assert.equal(health.amountDuePaise, 10_000);
  assert.equal(health.amountPaidPaise, 9_000);
});

test("group health applies the needs-attention and at-risk thresholds", () => {
  assert.equal(getGroupRepaymentHealth([activeLoan([installment(7_500)])], asOf).status, "NEEDS_ATTENTION");
  assert.equal(getGroupRepaymentHealth([activeLoan([installment(7_499)])], asOf).status, "AT_RISK");
});

test("group health is not rated before due installments or without active disbursed loans", () => {
  const futureInstallment = activeLoan([installment(0, "2026-12-01T00:00:00.000Z")]);
  const approvedLoan = { status: "APPROVED", schedule: [installment(0)] };
  const closedLoan = { status: "CLOSED", disbursedAt: asOf, schedule: [installment(0)] };

  assert.equal(getGroupRepaymentHealth([futureInstallment, approvedLoan, closedLoan], asOf).status, "NOT_RATED");
});
