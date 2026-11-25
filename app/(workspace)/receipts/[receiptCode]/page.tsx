import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { canAccessBorrower, requireActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { formatRupees } from "@/lib/loan-workflow";
import Collection, { type ICollection } from "@/models/Collection";
import PrintReceiptButton from "@/components/print-receipt-button";

export const instant = false;

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ receiptCode: string }>;
}) {
  const actor = await requireActor();
  const { receiptCode } = await params;
  await dbConnect();
  const collection = await Collection.findOne({ receiptCode })
    .populate("borrower", "name")
    .populate("collectedBy", "name")
    .populate("loan", "principalPaise status")
    .lean();
  if (!collection || !(await canAccessBorrower(actor, collection.borrower._id.toString()))) notFound();
  const isProcessingFeeCollection = collection.collectionType === "PROCESSING_FEE";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link className="inline-flex min-h-11 items-center gap-2 text-sm text-[#668272] hover:text-[#274c38]" href="/collections"><ArrowLeft className="h-4 w-4" />Back to collections</Link>
        <PrintReceiptButton><Printer className="h-4 w-4" />Print receipt</PrintReceiptButton>
      </div>
      <article className="rounded-2xl border border-[#e2eae4] bg-white p-4 shadow-sm sm:p-8 lg:p-10 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-[#dfe8e1] pb-6">
          <div className="min-w-0"><p className="text-xs font-semibold tracking-[0.16em] text-[#668272]">MITRA · COLLECTION RECEIPT</p><h1 className="mt-2 text-xl font-semibold tracking-tight text-[#17372f] sm:text-2xl">{isProcessingFeeCollection ? "Processing fee received" : "Payment received"}</h1></div>
          <span className="rounded-full bg-[#eaf4ed] px-3 py-1 text-xs font-semibold text-[#397253]">Recorded</span>
        </div>
        <div className="mt-7 rounded-xl bg-[#f7faf7] p-4 sm:p-5"><p className="text-xs text-[#829189]">Amount collected</p><p className="mt-1 break-words text-2xl font-semibold tracking-tight text-[#24513b] sm:text-3xl">{formatRupees(collection.amountPaise)}</p></div>
        <dl className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <div><dt className="text-[11px] text-[#8a9992]">Receipt number</dt><dd className="mt-1 text-sm font-semibold text-[#38594b]">{collection.receiptCode}</dd></div>
          <div><dt className="text-[11px] text-[#8a9992]">Date and time</dt><dd className="mt-1 text-sm font-medium text-[#49685b]">{new Date(collection.collectedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
          <div><dt className="text-[11px] text-[#8a9992]">Borrower</dt><dd className="mt-1 text-sm font-medium text-[#49685b]">{collection.borrower.name}</dd></div>
          <div><dt className="text-[11px] text-[#8a9992]">Collected by</dt><dd className="mt-1 text-sm font-medium text-[#49685b]">{collection.collectedBy.name}</dd></div>
          <div><dt className="text-[11px] text-[#8a9992]">Payment channel</dt><dd className="mt-1 text-sm font-medium text-[#49685b]">{collection.channel.replaceAll("_", " ").toLowerCase()}</dd></div>
          <div><dt className="text-[11px] text-[#8a9992]">Collection type</dt><dd className="mt-1 text-sm font-medium text-[#49685b]">{isProcessingFeeCollection ? "Processing fee" : "Installment"}</dd></div>
          <div><dt className="text-[11px] text-[#8a9992]">Account reference</dt><dd className="mt-1 text-sm font-medium text-[#49685b]">{collection.loan._id.toString().slice(-8).toUpperCase()}</dd></div>
          {collection.reference && <div><dt className="text-[11px] text-[#8a9992]">Payment reference</dt><dd className="mt-1 text-sm font-medium text-[#49685b]">{collection.reference}</dd></div>}
        </dl>
        {isProcessingFeeCollection ? (
          <div className="mt-8 border-t border-[#edf1ee] pt-5">
            <h2 className="text-xs font-semibold text-[#476653]">One-time processing fee payment</h2>
            <p className="mt-2 text-xs leading-5 text-[#84928b]">This payment was recorded against the loan&apos;s processing fee and was not allocated to a repayment installment.</p>
          </div>
        ) : (
          <div className="mt-8 border-t border-[#edf1ee] pt-5">
          <h2 className="mb-3 text-xs font-semibold text-[#476653]">Installment allocation</h2>
          <div aria-label="Installment allocation details" className="overflow-x-auto" role="region" tabIndex={0}>
            <table className="w-full min-w-[460px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[#91a098]"><tr><th className="pb-2 font-medium">Installment</th><th className="pb-2 font-medium">Principal</th><th className="pb-2 font-medium">Interest</th><th className="pb-2 font-medium">Penalty</th></tr></thead>
              <tbody className="divide-y divide-[#f0f3f0]">
                {collection.allocations.map((allocation: ICollection["allocations"][number]) => (
                  <tr key={allocation.installmentNo}>
                    <td className="py-2.5 text-[#668074]">#{allocation.installmentNo}</td>
                    <td className="py-2.5 text-[#49685b]">{formatRupees(allocation.principalPaise)}</td>
                    <td className="py-2.5 text-[#49685b]">{formatRupees(allocation.interestPaise)}</td>
                    <td className="py-2.5 text-[#49685b]">{formatRupees(allocation.penaltyPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
        <div className="mt-8 border-t border-dashed border-[#dfe8e1] pt-5 text-xs leading-5 text-[#84928b]">
          Keep this receipt for your records. For questions about this collection, contact your field manager. This receipt confirms a collection was recorded; it is not a bank settlement confirmation.
        </div>
      </article>
    </div>
  );
}
