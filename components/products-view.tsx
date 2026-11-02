"use client";

import { BadgeIndianRupee, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";

type Product = {
  _id: string;
  name: string;
  code: string;
  description?: string;
  minPrincipalPaise: number;
  maxPrincipalPaise: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  annualInterestRatePercent: number;
  maxDebtToIncomePercent: number;
  frequency: string;
  paymentWeekday?: number;
  paymentMonthDate?: number;
  dayCountBasis: string;
  graceDays: number;
  fixedLateFeePaise: number;
  penaltyAnnualRatePercent: number;
  penaltyCapPaise?: number;
  isActive: boolean;
  canEdit: boolean;
};

function currency(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

export default function ProductsView() {
  const { data, loading, error, reload } = useResource<{ products: Product[] }>("/api/loan-products");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [failure, setFailure] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [frequency, setFrequency] = useState("WEEKLY");

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch(
        editingProduct ? `/api/loan-products/${editingProduct._id}` : "/api/loan-products",
        {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          code: values.get("code"),
          description: values.get("description"),
          minPrincipalRupees: Number(values.get("minPrincipalRupees")),
          maxPrincipalRupees: Number(values.get("maxPrincipalRupees")),
          minTenureMonths: Number(values.get("minTenureMonths")),
          maxTenureMonths: Number(values.get("maxTenureMonths")),
          annualInterestRatePercent: Number(values.get("annualInterestRatePercent")),
          maxDebtToIncomePercent: Number(values.get("maxDebtToIncomePercent")),
          frequency: values.get("frequency"),
          paymentWeekday: values.has("paymentWeekday") ? Number(values.get("paymentWeekday")) : undefined,
          paymentMonthDate: values.has("paymentMonthDate") ? Number(values.get("paymentMonthDate")) : undefined,
          dayCountBasis: values.get("dayCountBasis"),
          graceDays: Number(values.get("graceDays")),
          fixedLateFeeRupees: Number(values.get("fixedLateFeeRupees") || 0),
          penaltyAnnualRatePercent: Number(values.get("penaltyAnnualRatePercent") || 0),
          penaltyCapRupees: values.get("penaltyCapRupees") ? Number(values.get("penaltyCapRupees")) : undefined,
        }),
        },
      );
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Loan product could not be ${editingProduct ? "updated" : "created"}.`);
      form.reset();
      setFrequency("WEEKLY");
      setOpen(false);
      setFeedback(editingProduct ? "Loan product updated." : "Loan product created.");
      setEditingProduct(null);
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : `Loan product could not be ${editingProduct ? "updated" : "created"}.`);
    } finally {
      setBusy(false);
    }
  }

  function edit(product: Product) {
    setFailure("");
    setFeedback("");
    setOpen(false);
    setEditingProduct(product);
    setFrequency(product.frequency);
  }

  function cancelEdit() {
    setEditingProduct(null);
    setOpen(false);
    setFrequency("WEEKLY");
    setFailure("");
  }

  async function toggle(product: Product) {
    setBusyId(product._id);
    setFailure("");
    try {
      const response = await fetch(`/api/loan-products/${product._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Loan product could not be updated.");
      setFeedback(`${product.name} ${product.isActive ? "deactivated" : "reactivated"}.`);
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Loan product could not be updated.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#dfe9e2] bg-white">
        <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => { cancelEdit(); setOpen(!open); }} type="button">
          <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><BadgeIndianRupee className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-[#24463a]">Configure a loan product</span><span className="mt-1 block text-xs text-[#8a9992]">Set amount, term, repayment, and late-charge policies</span></span></span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4c8062]"><Plus className="h-4 w-4" />New product</span>
        </button>
        {(open || editingProduct) && <form className="grid gap-4 border-t border-[#edf1ee] bg-[#fbfcfb] p-5 sm:grid-cols-2 xl:grid-cols-4" key={editingProduct?._id ?? "new"} onSubmit={saveProduct}>
          <label className="text-xs font-semibold text-[#526d61]">Product name<input className="form-control" defaultValue={editingProduct?.name} maxLength={100} name="name" required /></label>
          <label className="text-xs font-semibold text-[#526d61]">Product code<input className="form-control uppercase" defaultValue={editingProduct?.code} maxLength={24} name="code" required /></label>
          <label className="text-xs font-semibold text-[#526d61]">Annual interest rate (%)<input className="form-control" defaultValue={editingProduct?.annualInterestRatePercent} min="0" max="100" name="annualInterestRatePercent" required step="0.01" type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Max debt-to-income (%)<input className="form-control" defaultValue={editingProduct?.maxDebtToIncomePercent ?? 50} min="1" max="100" name="maxDebtToIncomePercent" required step="0.1" type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Repayment cadence<select className="form-control" defaultValue={editingProduct?.frequency ?? "WEEKLY"} name="frequency" onChange={(event) => setFrequency(event.target.value)}><option value="WEEKLY">Weekly</option><option value="FORTNIGHTLY">Fortnightly</option><option value="MONTHLY">Monthly</option></select></label>
          {frequency === "WEEKLY" && <label className="text-xs font-semibold text-[#526d61]">Payment day<select className="form-control" defaultValue={editingProduct?.paymentWeekday ?? 0} name="paymentWeekday" required>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, weekday) => <option key={day} value={weekday}>{day}</option>)}</select></label>}
          {frequency === "MONTHLY" && <label className="text-xs font-semibold text-[#526d61]">Payment date (day of month)<input className="form-control" defaultValue={editingProduct?.paymentMonthDate ?? 1} max="31" min="1" name="paymentMonthDate" required type="number" /></label>}
          <label className="text-xs font-semibold text-[#526d61]">Minimum principal (₹)<input className="form-control" defaultValue={editingProduct ? editingProduct.minPrincipalPaise / 100 : undefined} min="1" name="minPrincipalRupees" required step="0.01" type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Maximum principal (₹)<input className="form-control" defaultValue={editingProduct ? editingProduct.maxPrincipalPaise / 100 : undefined} min="1" name="maxPrincipalRupees" required step="0.01" type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Minimum term (months)<input className="form-control" defaultValue={editingProduct?.minTenureMonths} min="1" max="120" name="minTenureMonths" required type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Maximum term (months)<input className="form-control" defaultValue={editingProduct?.maxTenureMonths} min="1" max="120" name="maxTenureMonths" required type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Day-count basis<select className="form-control" defaultValue={editingProduct?.dayCountBasis ?? "ACTUAL_365"} name="dayCountBasis"><option value="ACTUAL_365">Actual / 365</option><option value="ACTUAL_360">Actual / 360</option></select></label>
          <label className="text-xs font-semibold text-[#526d61]">Penalty grace (days)<input className="form-control" defaultValue={editingProduct?.graceDays ?? 0} min="0" max="90" name="graceDays" required type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Fixed late charge (₹)<input className="form-control" defaultValue={editingProduct ? editingProduct.fixedLateFeePaise / 100 : 0} min="0" name="fixedLateFeeRupees" step="0.01" type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Penalty rate (% p.a.)<input className="form-control" defaultValue={editingProduct?.penaltyAnnualRatePercent ?? 0} min="0" max="100" name="penaltyAnnualRatePercent" step="0.01" type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61]">Penalty cap (₹)<input className="form-control" defaultValue={editingProduct?.penaltyCapPaise === undefined ? "" : editingProduct.penaltyCapPaise / 100} min="0" name="penaltyCapRupees" step="0.01" type="number" /></label>
          <label className="text-xs font-semibold text-[#526d61] xl:col-span-2">Description (optional)<input className="form-control" defaultValue={editingProduct?.description} maxLength={500} name="description" /></label>
          {failure && <div className="sm:col-span-2 xl:col-span-4"><InlineMessage message={failure} /></div>}
          <div className="flex items-end gap-2"><button className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60" disabled={busy} type="submit">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? "Saving…" : editingProduct ? "Save changes" : "Create product"}</button>{editingProduct && <button aria-label="Cancel editing" className="grid h-10 w-10 place-items-center rounded-lg border border-[#e0e8e2] text-[#688075]" onClick={cancelEdit} type="button"><X className="h-4 w-4" /></button>}</div>
        </form>}
      </section>

      {feedback && <InlineMessage message={feedback} tone="success" />}
      {!open && !editingProduct && failure && <InlineMessage message={failure} />}
      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
        <div className="border-b border-[#edf1ee] px-5 py-4"><h2 className="text-sm font-semibold text-[#24463a]">Loan products</h2><p className="mt-1 text-xs text-[#8a9992]">Terms applied to new loan applications</p></div>
        {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
          : error ? <div className="p-5"><InlineMessage message={error} /></div>
            : !data?.products.length ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">No products configured. Create a product to begin accepting applications.</p>
              : <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{data.products.map((product) => <article className="rounded-xl border border-[#e8eee9] p-4" key={product._id}><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-[#29483d]">{product.name}</p><p className="mt-1 text-xs text-[#8a9992]">{product.code} · {product.frequency.toLowerCase()}{product.frequency === "WEEKLY" && product.paymentWeekday !== undefined ? ` · ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][product.paymentWeekday]}` : product.frequency === "MONTHLY" && product.paymentMonthDate ? ` · day ${product.paymentMonthDate}` : ""}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${product.isActive ? "bg-[#eaf4ed] text-[#397253]" : "bg-[#f0f1ef] text-[#7e8882]"}`}>{product.isActive ? "Active" : "Inactive"}</span></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#eff3ef] pt-3 text-xs"><div><p className="text-[#91a098]">Principal range</p><p className="mt-1 font-medium text-[#526e60]">{currency(product.minPrincipalPaise)} – {currency(product.maxPrincipalPaise)}</p></div><div><p className="text-[#91a098]">Tenure</p><p className="mt-1 font-medium text-[#526e60]">{product.minTenureMonths}–{product.maxTenureMonths} months</p></div><div><p className="text-[#91a098]">Interest</p><p className="mt-1 font-medium text-[#526e60]">{product.annualInterestRatePercent}% p.a. · {product.dayCountBasis.replace("_", " / ")}</p></div><div><p className="text-[#91a098]">Affordability limit</p><p className="mt-1 font-medium text-[#526e60]">Debt-to-income ≤ {product.maxDebtToIncomePercent}%</p></div><div><p className="text-[#91a098]">Late charge</p><p className="mt-1 font-medium text-[#526e60]">{product.graceDays} grace days · {currency(product.fixedLateFeePaise)} + {product.penaltyAnnualRatePercent}%</p></div></div><div className="mt-4 flex items-center gap-4">{product.canEdit && <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#668272] hover:text-[#274c38] disabled:opacity-50" disabled={busyId === product._id} onClick={() => edit(product)} type="button"><Pencil className="h-3.5 w-3.5" />Edit</button>}<button className="text-[11px] font-semibold text-[#668272] hover:text-[#274c38] disabled:opacity-50" disabled={busyId === product._id} onClick={() => toggle(product)} type="button">{busyId === product._id ? "Saving…" : product.isActive ? "Deactivate product" : "Reactivate product"}</button></div></article>)}</div>}
      </section>
    </div>
  );
}
