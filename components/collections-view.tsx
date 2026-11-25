"use client";

import Link from "next/link";
import { Banknote, LoaderCircle, ReceiptIndianRupee } from "lucide-react";
import { useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { outstandingProcessingFeePaise } from "@/lib/processing-fee";
import type { UserRole } from "@/lib/roles";

type Loan = {
  _id: string;
  borrower: { name: string };
  status: string;
  principalPaise: number;
  processingFeePaise?: number;
  processingFeePaidPaise?: number;
  schedule: { status: string; dueDate: string; totalDuePaise: number; paidPaise: number }[];
};

type Collection = {
  _id: string;
  receiptCode: string;
  collectionType?: "INSTALLMENT" | "PROCESSING_FEE";
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
  const { data: loanData, loading: loansLoading, error: loansError, reload: reloadLoans } = useResource<{ loans: Loan[] }>("/api/loans");
  const { data, loading, error, reload } = useResource<{ collections: Collection[] }>("/api/collections");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [receipt, setReceipt] = useState("");
  const [collectionType, setCollectionType] = useState<"INSTALLMENT" | "PROCESSING_FEE">("INSTALLMENT");
  const [selectedLoanId, setSelectedLoanId] = useState("");

  const activeLoans = (loanData?.loans ?? []).filter((loan) => loan.status === "ACTIVE");
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const dueLoans = activeLoans.filter((loan) => loan.schedule.some((item) => item.status !== "PAID" && new Date(item.dueDate).getTime() <= todayUtc.getTime()));
  const feeDueLoans = activeLoans.filter((loan) => outstandingProcessingFeePaise(
    loan.processingFeePaise,
    loan.processingFeePaidPaise,
  ) > 0);
  const availableLoans = collectionType === "PROCESSING_FEE" ? feeDueLoans : dueLoans;
  const selectedFeeLoan = feeDueLoans.find((loan) => loan._id === selectedLoanId);
  const selectedFeeBalance = selectedFeeLoan
    ? outstandingProcessingFeePaise(selectedFeeLoan.processingFeePaise, selectedFeeLoan.processingFeePaidPaise)
    : 0;

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
          collectionType: values.get("collectionType"),
          amountRupees: Number(values.get("amountRupees")),
          channel: values.get("channel"),
          reference: values.get("reference"),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await response.json() as { error?: string; receiptCode?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Collection could not be recorded.");
      form.reset();
      setSelectedLoanId("");
      setReceipt(result.receiptCode ?? "");
      await Promise.all([reload(), reloadLoans()]);
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
          <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><Banknote className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[#24463a]">Record a field collection</h2><p className="mt-1 text-xs text-[#8a9992]">{collectionType === "PROCESSING_FEE" ? "Collect the one-time fee separately from repayment installments" : "Applied to the oldest due installment first; unpaid amounts remain overdue"}</p></div></div>
          {failure && <div className="mb-4"><InlineMessage message={failure} /></div>}
          {receipt && <div className="mb-4"><InlineMessage message={`Collection recorded. Receipt ${receipt} is ready. Notification adapter is in sandbox mode.`} tone="success" /></div>}
          <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" onSubmit={submit}>
            <label className="text-xs font-semibold text-[#526d61]">Collection type
              <select className="form-control" name="collectionType" onChange={(event) => { setCollectionType(event.target.value as "INSTALLMENT" | "PROCESSING_FEE"); setSelectedLoanId(""); }} value={collectionType}><option value="INSTALLMENT">Repayment installment</option><option value="PROCESSING_FEE">Processing fee</option></select>
            </label>
            <label className="text-xs font-semibold text-[#526d61] xl:col-span-2">Loan account
              <select className="form-control" key={collectionType} name="loanId" onChange={(event) => setSelectedLoanId(event.target.value)} required value={selectedLoanId}><option value="">Select a loan account</option>{availableLoans.map((loan) => <option key={loan._id} value={loan._id}>{loan.borrower?.name ?? "Customer"} · {collectionType === "PROCESSING_FEE" ? `Fee ${rupees(outstandingProcessingFeePaise(loan.processingFeePaise, loan.processingFeePaidPaise))}` : rupees(loan.principalPaise)}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-[#526d61]">Amount collected (₹)<input className="form-control" key={collectionType} max={collectionType === "PROCESSING_FEE" ? selectedFeeBalance / 100 || undefined : undefined} min="0.01" name="amountRupees" readOnly={collectionType === "PROCESSING_FEE"} required step="0.01" type="number" value={collectionType === "PROCESSING_FEE" ? selectedFeeBalance ? (selectedFeeBalance / 100).toFixed(2) : "" : undefined} /></label>
            <label className="text-xs font-semibold text-[#526d61]">Channel<select className="form-control" name="channel" required><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option></select></label>
            <label className="text-xs font-semibold text-[#526d61]">Reference (optional)<input className="form-control" maxLength={80} name="reference" placeholder="UPI or transfer reference" /></label>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end xl:col-span-6"><button className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:self-start" disabled={busy || loansLoading || Boolean(loansError) || availableLoans.length === 0} type="submit">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ReceiptIndianRupee className="h-4 w-4" />}{busy ? "Recording…" : collectionType === "PROCESSING_FEE" ? "Record fee payment" : "Record collection"}</button>{loansLoading ? <span className="text-xs text-[#8b9992]">Loading loan accounts…</span> : loansError ? <span className="text-xs text-[#a34343]">Loan accounts could not be loaded: {loansError}</span> : availableLoans.length === 0 && <span className="text-xs text-[#8b9992]">{collectionType === "PROCESSING_FEE" ? "No active loans have an outstanding processing fee." : "No active loans currently have due installments."}</span>}</div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
        <div className="border-b border-[#edf1ee] px-5 py-4"><h2 className="text-sm font-semibold text-[#24463a]">Collection receipts</h2><p className="mt-1 text-xs text-[#8a9992]">Latest recorded receipts in your access scope</p></div>
        {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
          : error ? <div className="p-5"><InlineMessage message={error} /></div>
            : !data?.collections.length ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">No receipts recorded yet.</p>
              : <>
                <div className="divide-y divide-[#edf1ee] sm:hidden">
                  {data.collections.map((item) => (
                    <article className="space-y-3 p-4" key={item._id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link className="break-all text-sm font-semibold text-[#4b8062] hover:underline" href={`/receipts/${item.receiptCode}`}>{item.receiptCode}</Link>
                          <p className="mt-1 break-words text-sm text-[#49685b]">{item.borrower?.name ?? "Customer"}</p>
                          <p className="mt-1 text-[10px] font-medium text-[#809087]">{item.collectionType === "PROCESSING_FEE" ? "Processing fee" : "Installment"}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-[#315444]">{rupees(item.amountPaise)}</p>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#f0f3f0] pt-3 text-xs">
                        <div><dt className="text-[#91a098]">Collected by</dt><dd className="mt-1 break-words text-[#73857b]">{item.collectedBy?.name ?? "Field officer"}</dd></div>
                        <div><dt className="text-[#91a098]">Channel</dt><dd className="mt-1 text-[#73857b]">{item.channel.replaceAll("_", " ").toLowerCase()}</dd></div>
                        <div><dt className="text-[#91a098]">Date</dt><dd className="mt-1 text-[#73857b]">{new Date(item.collectedAt).toLocaleDateString("en-IN")}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[720px] text-left"><thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]"><tr><th className="px-5 py-3">Receipt</th><th className="px-5 py-3">Borrower</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Collected by</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Channel</th><th className="px-5 py-3">Date</th></tr></thead><tbody className="divide-y divide-[#f0f3f0]">{data.collections.map((item) => <tr key={item._id}><td className="px-5 py-4"><Link className="text-xs font-semibold text-[#4b8062] hover:underline" href={`/receipts/${item.receiptCode}`}>{item.receiptCode}</Link></td><td className="px-5 py-4 text-sm text-[#49685b]">{item.borrower?.name ?? "Customer"}</td><td className="px-5 py-4 text-xs text-[#73857b]">{item.collectionType === "PROCESSING_FEE" ? "Processing fee" : "Installment"}</td><td className="px-5 py-4 text-xs text-[#73857b]">{item.collectedBy?.name ?? "Field officer"}</td><td className="px-5 py-4 text-sm font-semibold text-[#315444]">{rupees(item.amountPaise)}</td><td className="px-5 py-4 text-xs text-[#73857b]">{item.channel.replaceAll("_", " ").toLowerCase()}</td><td className="px-5 py-4 text-xs text-[#73857b]">{new Date(item.collectedAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div>
              </>}
      </section>
    </div>
  );
}
