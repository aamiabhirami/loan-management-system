import assert from "node:assert/strict";
import test from "node:test";
import { getLoanApprovalBlocker } from "../lib/loan-workflow.ts";

const eligibleCreditCheck = {
  status: "COMPLETED",
  consentedAt: new Date("2026-01-01T00:00:00.000Z"),
  decisionEligible: true,
};

test("loan approval is blocked when affordability fails", () => {
  assert.match(getLoanApprovalBlocker({
    affordabilityPassed: false,
    creditCheck: eligibleCreditCheck,
    isProduction: false,
  }), /debt-to-income limit/);
});

test("loan approval explains that borrower consent and a check are missing", () => {
  assert.match(getLoanApprovalBlocker({
    affordabilityPassed: true,
    isProduction: false,
  }), /borrower consent and credit check/);
});

test("loan approval rejects missing consent and failed or ineligible checks", () => {
  for (const creditCheck of [
    { ...eligibleCreditCheck, consentedAt: null },
    { ...eligibleCreditCheck, status: "FAILED" },
    { ...eligibleCreditCheck, decisionEligible: false },
  ]) {
    assert.ok(getLoanApprovalBlocker({
      affordabilityPassed: true,
      creditCheck,
      isProduction: false,
    }));
  }
});

test("sandbox credit checks block production approval but remain usable in non-production", () => {
  const creditCheck = {
    ...eligibleCreditCheck,
    status: "SANDBOX",
    decisionEligible: false,
  };

  assert.match(getLoanApprovalBlocker({
    affordabilityPassed: true,
    creditCheck,
    isProduction: true,
  }), /sandbox credit check/);
  assert.equal(getLoanApprovalBlocker({
    affordabilityPassed: true,
    creditCheck,
    isProduction: false,
  }), null);
});

test("credit-check override permits approval in production but does not bypass affordability", () => {
  assert.equal(getLoanApprovalBlocker({
    affordabilityPassed: true,
    isProduction: true,
    bypassCreditCheck: true,
  }), null);
  assert.match(getLoanApprovalBlocker({
    affordabilityPassed: false,
    isProduction: true,
    bypassCreditCheck: true,
  }), /debt-to-income limit/);
});
