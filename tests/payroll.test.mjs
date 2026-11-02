import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayroll, dateField, monthRange, parsePayComponents } from "../lib/payroll.ts";
import { isOrganizationAdmin, roleLabel } from "../lib/roles.ts";

test("payroll totals use integer paise and reject deductions above earnings", () => {
  assert.deepEqual(calculatePayroll(
    [{ label: "Salary", amountPaise: 2_500_000 }, { label: "Travel", amountPaise: 100_000 }],
    [{ label: "Advance", amountPaise: 50_000 }],
  ), { grossPaise: 2_600_000, deductionsPaise: 50_000, netPaise: 2_550_000 });
  assert.throws(
    () => calculatePayroll([{ label: "Salary", amountPaise: 100 }], [{ label: "Recovery", amountPaise: 200 }]),
    /cannot exceed gross earnings/,
  );
  assert.throws(() => calculatePayroll([{ label: "Salary", amountPaise: 1.5 }], []), /whole amounts in paise/);
  assert.throws(() => calculatePayroll([], []), /at least one earning/);
});

test("payroll component input is bounded and validates line labels and amounts", () => {
  assert.deepEqual(parsePayComponents([{ label: "Salary", amountRupees: 100 }], "Earnings"), [
    { label: "Salary", amountRupees: 100 },
  ]);
  assert.throws(() => parsePayComponents([{ label: "", amountRupees: 100 }], "Earnings"), /needs a label/);
  assert.throws(() => parsePayComponents([{ label: "Salary", amountRupees: 0 }], "Earnings"), /positive amount/);
  assert.throws(() => parsePayComponents([{ label: "Salary", amountRupees: 0.005 }], "Earnings"), /positive amount/);
  assert.throws(() => parsePayComponents(Array(21).fill({ label: "Item", amountRupees: 1 }), "Earnings"), /no more than 20/);
});

test("payroll dates and month filters reject invalid values", () => {
  assert.equal(dateField("2026-02-28", "Date").toISOString(), "2026-02-28T00:00:00.000Z");
  assert.throws(() => dateField("2026-02-30", "Date"), /valid date/);
  assert.equal(monthRange("2026-12").end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.throws(() => monthRange("2026-13"), /valid payroll month/);
});

test("director and shareholder roles have organization administrator access", () => {
  assert.equal(isOrganizationAdmin("admin"), true);
  assert.equal(isOrganizationAdmin("director"), true);
  assert.equal(isOrganizationAdmin("shareholder"), true);
  assert.equal(isOrganizationAdmin("privileged"), false);
  assert.equal(roleLabel("director"), "Director");
  assert.equal(roleLabel("shareholder"), "Shareholder");
});
