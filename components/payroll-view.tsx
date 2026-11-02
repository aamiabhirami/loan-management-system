"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { formatRupees } from "@/lib/loan-workflow";
import { roleLabel, type UserRole } from "@/lib/roles";

type StaffRow = { _id: string; name: string; role: UserRole; isActive: boolean };
type PayrollRow = {
  _id: string;
  employee: { name: string; role: UserRole };
  periodStart: string;
  periodEnd: string;
  earnings: { label: string; amountPaise: number }[];
  deductions: { label: string; amountPaise: number }[];
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  status: "DRAFT" | "PAID";
  paidAt?: string;
  notes?: string;
};
type PayrollResponse = {
  month: string;
  records: PayrollRow[];
  totals: { grossPaise: number; deductionsPaise: number; netPaise: number; paidPaise: number; draftPaise: number };
};

function parseLines(input: FormDataEntryValue | null) {
  if (typeof input !== "string") return [];
  return input.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.lastIndexOf(",");
    if (separator < 1) throw new Error("Use one earning or deduction per line: Label, amount.");
    const amountRupees = Number(line.slice(separator + 1).trim());
    if (!Number.isFinite(amountRupees)) throw new Error("Each payroll line must end with a numeric amount in rupees.");
    return { label: line.slice(0, separator).trim(), amountRupees };
  });
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { timeZone: "UTC" });
}

export default function PayrollView() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, loading, error, reload } = useResource<PayrollResponse>(`/api/payroll?month=${month}`);
  const { data: staffData } = useResource<{ users: StaffRow[] }>("/api/users");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [failure, setFailure] = useState("");
  const [feedback, setFeedback] = useState("");
  const employees = (staffData?.users ?? []).filter((user) => user.isActive && ["director", "privileged"].includes(user.role));

  async function createPayroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: values.get("employeeId"),
          periodStart: values.get("periodStart"),
          periodEnd: values.get("periodEnd"),
          earnings: parseLines(values.get("earnings")),
          deductions: parseLines(values.get("deductions")),
          notes: values.get("notes"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Payroll record could not be created.");
      form.reset();
      setFeedback("Payroll record created as a draft.");
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Payroll record could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(record: PayrollRow) {
    setBusyId(record._id);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch(`/api/payroll/${record._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString().slice(0, 10) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Payroll status could not be updated.");
      setFeedback("Payroll marked as paid. No bank transfer was initiated.");
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Payroll status could not be updated.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#dfe9e2] bg-white">
        <div className="flex items-center gap-3 border-b border-[#edf1ee] px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><Plus className="h-4 w-4" /></span>
          <div><h2 className="text-sm font-semibold text-[#24463a]">Create payroll record</h2><p className="mt-1 text-xs text-[#8a9992]">For directors and field managers/collection agents; this does not initiate a bank payment.</p></div>
        </div>
        <form className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3" onSubmit={createPayroll}>
          <label className="text-xs font-semibold text-[#526d61]">Employee<select className="form-control" name="employeeId" required><option value="">Select staff member</option>{employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.name} · {roleLabel(employee.role)}</option>)}</select></label>
          <label className="text-xs font-semibold text-[#526d61]">Period start<input className="form-control" name="periodStart" required type="date" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Period end<input className="form-control" name="periodEnd" required type="date" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Earnings (label, rupees per line)<textarea className="form-control min-h-24" name="earnings" placeholder={"Base salary, 25000\nTravel allowance, 1500"} required /></label>
          <label className="text-xs font-semibold text-[#526d61]">Deductions (optional)<textarea className="form-control min-h-24" name="deductions" placeholder={"Advance recovery, 1000"} /></label>
          <label className="text-xs font-semibold text-[#526d61]">Notes (optional)<textarea className="form-control min-h-24" maxLength={1000} name="notes" /></label>
          <div className="sm:col-span-2 xl:col-span-3"><button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60" disabled={busy || employees.length === 0} type="submit">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? "Saving…" : "Create draft payroll"}</button>{employees.length === 0 && <p className="mt-2 text-xs text-[#9a7650]">Create an active director or field-manager account before recording payroll.</p>}</div>
        </form>
      </section>

      {(failure || feedback) && <InlineMessage message={failure || feedback} tone={failure ? "error" : "success"} />}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-[#24463a]">Payroll report</h2><p className="mt-1 text-xs text-[#8a9992]">Totals for records starting in the selected month.</p></div>
          <label className="text-xs font-semibold text-[#526d61]">Report month<input className="form-control mt-1" onChange={(event) => setMonth(event.target.value)} type="month" value={month} /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Gross", data?.totals.grossPaise ?? 0],
            ["Deductions", data?.totals.deductionsPaise ?? 0],
            ["Net", data?.totals.netPaise ?? 0],
            ["Paid", data?.totals.paidPaise ?? 0],
            ["Draft", data?.totals.draftPaise ?? 0],
          ].map(([label, amount]) => <div className="rounded-xl border border-[#e7ece8] bg-white p-4" key={label}><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#87968e]">{label}</p><p className="mt-2 text-lg font-semibold text-[#315444]">{formatRupees(Number(amount))}</p></div>)}
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
          {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
            : error ? <div className="p-5"><InlineMessage message={error} /></div>
              : !data?.records.length ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">No payroll records for {month}.</p>
                : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left">
                  <thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Pay period</th><th className="px-5 py-3">Earnings</th><th className="px-5 py-3">Deductions</th><th className="px-5 py-3">Net pay</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead>
                  <tbody className="divide-y divide-[#f0f3f0]">{data.records.map((record) => <tr key={record._id}>
                    <td className="px-5 py-4"><p className="text-sm font-medium text-[#29483d]">{record.employee.name}</p><p className="mt-1 text-xs text-[#8a9992]">{roleLabel(record.employee.role)}</p></td>
                    <td className="px-5 py-4 text-xs text-[#73857b]">{shortDate(record.periodStart)} – {shortDate(record.periodEnd)}</td>
                    <td className="px-5 py-4 text-xs text-[#73857b]">{formatRupees(record.grossPaise)}</td>
                    <td className="px-5 py-4 text-xs text-[#73857b]">{formatRupees(record.deductionsPaise)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#315444]">{formatRupees(record.netPaise)}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${record.status === "PAID" ? "bg-[#eaf4ed] text-[#397253]" : "bg-[#fff4df] text-[#8d7041]"}`}>{record.status.toLowerCase()}</span>{record.paidAt && <p className="mt-1 text-[10px] text-[#8a9992]">{shortDate(record.paidAt)}</p>}</td>
                    <td className="px-5 py-4">{record.status === "DRAFT" && <button className="text-xs font-semibold text-[#668272] hover:text-[#274c38] disabled:opacity-50" disabled={busyId === record._id} onClick={() => markPaid(record)} type="button">{busyId === record._id ? "Saving…" : "Mark paid"}</button>}</td>
                  </tr>)}</tbody>
                </table></div>}
        </div>
      </section>
    </div>
  );
}
