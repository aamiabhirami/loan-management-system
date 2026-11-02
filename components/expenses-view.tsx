"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { formatRupees } from "@/lib/loan-workflow";

type ExpenseRow = {
  _id: string;
  category: string;
  amountPaise: number;
  incurredAt: string;
  payee: string;
  notes?: string;
  receiptStorageRef?: string;
  createdBy?: { name: string };
};

function localDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { timeZone: "UTC" });
}

export default function ExpensesView() {
  const { data, loading, error, reload } = useResource<{ expenses: ExpenseRow[] }>("/api/expenses");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState("");

  async function createExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: values.get("category"),
          amountRupees: Number(values.get("amountRupees")),
          incurredAt: values.get("incurredAt"),
          payee: values.get("payee"),
          notes: values.get("notes"),
          receiptStorageRef: values.get("receiptStorageRef"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Expense could not be recorded.");
      form.reset();
      setFeedback("Expense recorded.");
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Expense could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#dfe9e2] bg-white">
        <div className="flex items-center gap-3 border-b border-[#edf1ee] px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><Plus className="h-4 w-4" /></span>
          <div><h2 className="text-sm font-semibold text-[#24463a]">Record a business expense</h2><p className="mt-1 text-xs text-[#8a9992]">Amounts are recorded in INR. Receipt files stay in your private storage.</p></div>
        </div>
        <form className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3" onSubmit={createExpense}>
          <label className="text-xs font-semibold text-[#526d61]">Category<input className="form-control" maxLength={80} name="category" placeholder="Travel, rent, utilities…" required /></label>
          <label className="text-xs font-semibold text-[#526d61]">Amount (₹)<input className="form-control" min="0.01" max="100000000" name="amountRupees" required step="0.01" type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Expense date<input className="form-control" defaultValue={new Date().toISOString().slice(0, 10)} name="incurredAt" required type="date" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Payee<input className="form-control" maxLength={120} name="payee" required /></label>
          <label className="text-xs font-semibold text-[#526d61]">Receipt storage reference (optional)<input className="form-control" maxLength={300} name="receiptStorageRef" placeholder="receipts/2026/INV-001.pdf" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Notes (optional)<input className="form-control" maxLength={1000} name="notes" /></label>
          <div className="sm:col-span-2 xl:col-span-3"><button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60" disabled={busy} type="submit">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? "Saving…" : "Save expense"}</button></div>
        </form>
      </section>

      {(failure || feedback) && <InlineMessage message={failure || feedback} tone={failure ? "error" : "success"} />}
      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
        <div className="border-b border-[#edf1ee] px-5 py-4"><h2 className="text-sm font-semibold text-[#24463a]">Business expenses</h2><p className="mt-1 text-xs text-[#8a9992]">{data?.expenses.length ?? 0} records</p></div>
        {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
          : error ? <div className="p-5"><InlineMessage message={error} /></div>
            : !data?.expenses.length ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">No expenses recorded yet.</p>
              : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left">
                <thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Category / payee</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Notes</th><th className="px-5 py-3">Receipt reference</th><th className="px-5 py-3">Recorded by</th></tr></thead>
                <tbody className="divide-y divide-[#f0f3f0]">{data.expenses.map((expense) => <tr key={expense._id}>
                  <td className="px-5 py-4 text-xs text-[#73857b]">{localDate(expense.incurredAt)}</td>
                  <td className="px-5 py-4"><p className="text-sm font-medium text-[#29483d]">{expense.category}</p><p className="mt-1 text-xs text-[#8a9992]">{expense.payee}</p></td>
                  <td className="px-5 py-4 text-sm font-semibold text-[#315444]">{formatRupees(expense.amountPaise)}</td>
                  <td className="max-w-[220px] px-5 py-4 text-xs text-[#73857b]">{expense.notes || "—"}</td>
                  <td className="px-5 py-4 font-mono text-[11px] text-[#73857b]">{expense.receiptStorageRef || "—"}</td>
                  <td className="px-5 py-4 text-xs text-[#73857b]">{expense.createdBy?.name ?? "—"}</td>
                </tr>)}</tbody>
              </table></div>}
      </section>
    </div>
  );
}
