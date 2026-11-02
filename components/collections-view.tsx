"use client";

import Link from "next/link";
import { Banknote, LoaderCircle, ReceiptIndianRupee } from "lucide-react";
import { useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import type { UserRole } from "@/lib/roles";

type Loan = {
  _id: string;
  borrower: { name: string };
  status: string;
  principalPaise: number;
  schedule: { status: string; dueDate: string; totalDuePaise: number; paidPaise: number }[];
};

type Collection = {
  _id: string;
  receiptCode: string;
  amountPaise: number;
  channel: string;
  collectedAt: string;
  borrower?: { name: string };
  collectedBy?: { name: string };
};

function rupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

export default function CollectionsView({ role }: { role: UserRole }) {
  const { data: loanData } = useResource<{ loans: Loan[] }>("/api/loans");
  const { data, loading, error, reload } = useResource<{ collections: Collection[] }>("/api/collections");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [receipt, setReceipt] = useState("");

  const activeLoans = (loanData?.loans ?? []).filter((loan) => loan.status === "ACTIVE");
  const dueLoans = activeLoans.filter((loan) => loan.schedule.some((item) => item.status !== "PAID" && new Date(item.dueDate).getTime() <= Date.now()));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setFailure("");
    setReceipt("");
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: values.get("loanId"),
          amountRupees: Number(values.get("amountRupees")),
          channel: values.get("channel"),
          reference: values.get("reference"),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await response.json() as { error?: string; receiptCode?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Collection could not be recorded.");
      form.reset();
      setReceipt(result.receiptCode ?? "");
      await Promise.all([reload()]);
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Collection could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {role !== "user" && (
        <section className="rounded-2xl border border-[#dfe9e2] bg-white p-5">
          <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><Banknote className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[#24463a]">Record a field collection</h2><p className="mt-1 text-xs text-[#8a9992]">Apply a collection to due installments in date order</p></div></div>
          {failure && <div className="mb-4"><InlineMessage message={failure} /></div>}
          {receipt && <div className="mb-4"><InlineMessage message={`Collection recorded. Receipt ${receipt} is ready. Notification adapter is in sandbox mode.`} tone="success" /></div>}
          <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
            <label className="text-xs font-semibold text-[#526d61] xl:col-span-2">Loan account
              <select className="form-control" name="loanId" required><option value="">Select a loan account</option>{dueLoans.map((loan) => <option key={loan._id} value={loan._id}>{loan.borrower?.name ?? "Customer"} · {rupees(loan.principalPaise)}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-[#526d61]">Amount collected (₹)<input className="form-control" min="0.01" name="amountRupees" required step="0.01" type="number" /></label>
            <label className="text-xs font-semibold text-[#526d61]">Channel<select className="form-control" name="channel" required><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option></select></label>
            <label className="text-xs font-semibold text-[#526d61]">Reference (optional)<input className="form-control" maxLength={80} name="reference" placeholder="UPI or transfer reference" /></label>
            <div className="flex items-end xl:col-span-5"><button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || dueLoans.length === 0} type="submit">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ReceiptIndianRupee className="h-4 w-4" />}{busy ? "Recording…" : "Record collection"}</button>{dueLoans.length === 0 && <span className="ml-3 text-xs text-[#8b9992]">No active loans currently have due installments.</span>}</div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
        <div className="border-b border-[#edf1ee] px-5 py-4"><h2 className="text-sm font-semibold text-[#24463a]">Collection receipts</h2><p className="mt-1 text-xs text-[#8a9992]">Latest recorded receipts in your access scope</p></div>
        {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
          : error ? <div className="p-5"><InlineMessage message={error} /></div>
            : !data?.collections.length ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">No receipts recorded yet.</p>
              : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]"><tr><th className="px-5 py-3">Receipt</th><th className="px-5 py-3">Borrower</th><th className="px-5 py-3">Collected by</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Channel</th><th className="px-5 py-3">Date</th></tr></thead><tbody className="divide-y divide-[#f0f3f0]">{data.collections.map((item) => <tr key={item._id}><td className="px-5 py-4"><Link className="text-xs font-semibold text-[#4b8062] hover:underline" href={`/receipts/${item.receiptCode}`}>{item.receiptCode}</Link></td><td className="px-5 py-4 text-sm text-[#49685b]">{item.borrower?.name ?? "Customer"}</td><td className="px-5 py-4 text-xs text-[#73857b]">{item.collectedBy?.name ?? "Field officer"}</td><td className="px-5 py-4 text-sm font-semibold text-[#315444]">{rupees(item.amountPaise)}</td><td className="px-5 py-4 text-xs text-[#73857b]">{item.channel.replaceAll("_", " ").toLowerCase()}</td><td className="px-5 py-4 text-xs text-[#73857b]">{new Date(item.collectedAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
