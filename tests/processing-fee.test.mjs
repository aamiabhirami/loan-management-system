import assert from "node:assert/strict";
import test from "node:test";
import { outstandingProcessingFeePaise } from "../lib/processing-fee.ts";

test("processing fee balance accounts for partial payments", () => {
  assert.equal(outstandingProcessingFeePaise(12_500, 5_000), 7_500);
});

test("processing fee balance is zero for legacy loans without fee fields or overpayment", () => {
  assert.equal(outstandingProcessingFeePaise(undefined, undefined), 0);
  assert.equal(outstandingProcessingFeePaise(12_500, 15_000), 0);
});
