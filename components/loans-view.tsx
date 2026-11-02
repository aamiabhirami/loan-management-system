"use client";

import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useResource } from "@/components/use-resource";
import { generateAmortizationSchedule, type DayCountBasis, type RepaymentFrequency } from "@/lib/finance";
import InlineMessage from "@/components/inline-message";
import { getLoanApprovalBlocker, installmentCount } from "@/lib/loan-workflow";
import { isOrganizationAdmin, type UserRole } from "@/lib/roles";

type Product = {
  _id: string;
  name: string;
  code: string;
  minPrincipalPaise: number;
  maxPrincipalPaise: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  frequency: RepaymentFrequency;
  dayCountBasis: DayCountBasis;
  annualInterestRatePercent: number;
};

type Customer = { _id: string; name: string; email: string; role: string };
type Group = { _id: string; name: string; centerName: string };
type Loan = {
  _id: string;
  borrower: Customer;
  product: { name: string; code: string };
  principalPaise: number;
  tenureMonths: number;
  frequency: string;
  annualInterestRatePercent: number;
  debtToIncomePercent: number;
  affordabilityPassed: boolean;
  estimatedMonthlyInstallmentPaise: number;
  status: string;
  createdAt: string;
  creditCheck?: { provider: string; status: "SANDBOX" | "COMPLETED" | "FAILED"; checkedAt: string; consentedAt?: string; decisionEligible: boolean };
  schedule: { installmentNo: number; dueDate: string; totalDuePaise: number; status: string }[];
};

function rupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

async function send(url: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { error?: string; message?: string };
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  return result;
}

export default function LoansView({ actorId, role }: { actorId: string; role: UserRole }) {
  const { data, loading, error, reload } = useResource<{ loans: Loan[]; isProduction: boolean }>("/api/loans");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");

  const loans = useMemo(() => {
    const items = data?.loans ?? [];
    return items.filter((loan) => `${loan.borrower?.name ?? ""} ${loan.product?.name ?? ""} ${loan.status}`.toLowerCase().includes(query.toLowerCase()));
  }, [data, query]);

  async function action(loan: Loan, actionName: "approve" | "approve_without_credit_check" | "reject" | "disburse" | "credit") {
    setBusyId(loan._id);
    setFailure("");
    setMessage("");
    try {
      if (actionName === "credit") {
        await send(`/api/loans/${loan._id}/credit-check`, "POST", { consent: true });
        setMessage("Sandbox inquiry saved. This is not a live bureau report.");
      } else if (actionName === "reject") {
        const reason = window.prompt("Provide the reason for declining this application.");
        if (!reason?.trim()) return;
        await send(`/api/loans/${loan._id}`, "PATCH", { action: actionName, reason: reason.trim() });
        setMessage("Application declined.");
      } else if (actionName === "approve_without_credit_check") {
        const reason = window.prompt("Provide the reason for approving without a credit bureau check. The affordability requirement still applies.");
        if (!reason?.trim()) return;
        await send(`/api/loans/${loan._id}`, "PATCH", { action: actionName, reason: reason.trim() });
        setMessage("Application approved without a credit bureau check. The override reason was recorded.");
      } else {
        const result = await send(`/api/loans/${loan._id}`, "PATCH", { action: actionName });
        setMessage(actionName === "disburse" ? String(result.message) : "Application approved.");
      }
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "The request could not be completed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      <LoanApplicationForm role={role} onCreated={async () => { setMessage("Loan application created."); await reload(); }} />
      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ee] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#24463a]">Loan applications</h2>
            <p className="mt-1 text-xs text-[#8a9992]">{data?.loans.length ?? 0} accounts in your access scope</p>
          </div>
          <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-[#e4ebe6] px-3 sm:w-64">
            <Search className="h-4 w-4 text-[#92a098]" />
            <input className="w-full bg-transparent text-xs outline-none placeholder:text-[#9ba8a2]" onChange={(event) => setQuery(event.target.value)} placeholder="Search borrower or product" />
          </label>
        </div>
        {failure && <div className="px-5 pt-4"><InlineMessage message={failure} /></div>}
        {message && <div className="px-5 pt-4"><InlineMessage message={message} tone="success" /></div>}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-[#819189]"><LoaderCircle className="h-4 w-4 animate-spin" />Loading loan accounts…</div>
        ) : error ? (
          <div className="p-5"><InlineMessage message={error} /></div>
        ) : loans.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FileText className="mx-auto h-6 w-6 text-[#89a091]" />
            <p className="mt-3 text-sm font-medium text-[#38594b]">No matching loan accounts</p>
            <p className="mt-1 text-xs text-[#89968f]">Create a loan application to begin servicing an account.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]">
                <tr>
                  <th className="px-5 py-3">Borrower</th><th className="px-5 py-3">Loan product</th><th className="px-5 py-3">Principal</th><th className="px-5 py-3">Term / cadence</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Next installment</th><th className="px-5 py-3">Affordability</th><th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3f0]">
                {loans.map((loan) => {
                  const next = loan.schedule?.find((installment) => installment.status !== "PAID");
                  const working = busyId === loan._id;
                  const approvalBlocker = getLoanApprovalBlocker({
                    affordabilityPassed: loan.affordabilityPassed,
                    creditCheck: loan.creditCheck,
                    isProduction: data?.isProduction ?? false,
                  });
                  return (
                    <tr className="align-top" key={loan._id}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-[#29483d]">{loan.borrower?.name ?? "Customer"}</p>
                        <p className="mt-1 text-[11px] text-[#91a098]">Applied {date(loan.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-medium text-[#49685b]">{loan.product?.name ?? "Loan product"}</p>
                        <p className="mt-1 text-[10px] text-[#92a098]">{loan.annualInterestRatePercent}% p.a.</p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#315444]">{rupees(loan.principalPaise)}</td>
                      <td className="px-5 py-4 text-xs text-[#6f8179]">{loan.tenureMonths} months <span className="text-[#a0aaa5]">·</span> {loan.frequency.toLowerCase()}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          loan.status === "ACTIVE" ? "bg-[#eaf4ed] text-[#397253]"
                            : loan.status === "PENDING_APPROVAL" ? "bg-[#fbf2dc] text-[#9e792c]"
                              : loan.status === "REJECTED" ? "bg-[#fbe9e5] text-[#a34d40]"
                                : "bg-[#edf2ef] text-[#667d72]"
                        }`}>{loan.status.replaceAll("_", " ").toLowerCase()}</span>
                        {loan.creditCheck?.status === "SANDBOX" && <p className="mt-1 text-[10px] text-[#a07832]">Sandbox bureau check</p>}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#6f8179]">{next ? `${date(next.dueDate)} · ${rupees(next.totalDuePaise)}` : loan.status === "PENDING_APPROVAL" ? `Est. ${rupees(loan.estimatedMonthlyInstallmentPaise)}/mo` : loan.status === "ACTIVE" ? "Schedule pending" : "—"}</td>
                      <td className="px-5 py-4 text-xs text-[#6f8179]">
                        <span className={`font-medium ${loan.affordabilityPassed ? "text-[#56815f]" : "text-[#a36e31]"}`}>{loan.debtToIncomePercent.toFixed(1)}% debt-to-income</span>
                        <p className="mt-1 text-[10px] text-[#99a49e]">{loan.affordabilityPassed ? "Within product limit" : "Above product limit"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {loan.status === "PENDING_APPROVAL" && loan.borrower?._id === actorId && !loan.creditCheck && (
                            <button className="inline-flex items-center gap-1 rounded-md border border-[#d9e8dd] px-2 py-1.5 text-[10px] font-semibold text-[#437450] hover:bg-[#f2f8f3] disabled:opacity-50" disabled={working} onClick={() => action(loan, "credit")} type="button">
                              <ShieldCheck className="h-3.5 w-3.5" /> Consent + check
                            </button>
                          )}
                          {isOrganizationAdmin(role) && loan.status === "PENDING_APPROVAL" && (
                            <>
                              <button aria-describedby={approvalBlocker ? `approval-blocker-${loan._id}` : undefined} className="inline-flex items-center gap-1 rounded-md bg-[#e9f4eb] px-2 py-1.5 text-[10px] font-semibold text-[#3d744d] hover:bg-[#ddefe0] disabled:cursor-not-allowed disabled:opacity-50" disabled={working || Boolean(approvalBlocker)} onClick={() => action(loan, "approve")} title={approvalBlocker ?? undefined} type="button"><Check className="h-3.5 w-3.5" />Approve</button>
                              {approvalBlocker && loan.affordabilityPassed && <button className="inline-flex items-center gap-1 rounded-md border border-[#e7c98c] px-2 py-1.5 text-[10px] font-semibold text-[#886423] hover:bg-[#fff9eb] disabled:opacity-50" disabled={working} onClick={() => action(loan, "approve_without_credit_check")} title="Bypass only the credit-check requirement; a reason is required and affordability must still pass." type="button"><Check className="h-3.5 w-3.5" />Approve without bureau check</button>}
                              <button className="inline-flex items-center gap-1 rounded-md border border-[#f0dfdc] px-2 py-1.5 text-[10px] font-semibold text-[#a55649] hover:bg-[#fff6f4] disabled:opacity-50" disabled={working} onClick={() => action(loan, "reject")} type="button"><X className="h-3.5 w-3.5" />Decline</button>
                              {approvalBlocker && <p className="basis-full text-[10px] leading-4 text-[#986b29]" id={`approval-blocker-${loan._id}`}>{approvalBlocker}</p>}
                            </>
                          )}
                          {!isOrganizationAdmin(role) && loan.status === "PENDING_APPROVAL" && <p className="basis-full text-[10px] leading-4 text-[#87958e]">An organization administrator makes the approval decision.</p>}
                          {isOrganizationAdmin(role) && loan.status === "APPROVED" && (
                            data?.isProduction
                              ? <span className="text-[10px] leading-4 text-[#986b29]">Live disbursement is not configured in production.</span>
                              : <button className="inline-flex items-center gap-1 rounded-md bg-[#173b33] px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-[#245548] disabled:opacity-50" disabled={working} onClick={() => action(loan, "disburse")} type="button"><ArrowDownToLine className="h-3.5 w-3.5" />Disburse</button>
                          )}
                          {working && <LoaderCircle className="h-4 w-4 animate-spin text-[#769280]" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-start gap-2 border-t border-[#edf1ee] bg-[#fafbf9] px-5 py-3 text-[11px] leading-5 text-[#87958e]">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a48c55]" />
          Bureau checks and disbursements are sandbox-only until live provider agreements and credentials are configured. Sandbox results must not be used for real lending decisions.
        </div>
      </section>
    </div>
  );
}

function LoanApplicationForm({ role, onCreated }: { role: UserRole; onCreated: () => Promise<void> }) {
  const { data: productsData } = useResource<{ products: Product[] }>("/api/loan-products");
  const { data: usersData } = useResource<{ users: Customer[] }>("/api/users");
  const { data: groupsData } = useResource<{ groups: Group[] }>("/api/groups");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [principalRupees, setPrincipalRupees] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");
  const selectedProduct = productsData?.products.find((product) => product._id === productId);
  const installmentAmountPaise = useMemo(() => {
    if (!selectedProduct || !principalRupees || !tenureMonths) return null;

    const principalPaise = Math.round(Number(principalRupees) * 100);
    const tenure = Number(tenureMonths);
    if (
      !Number.isSafeInteger(principalPaise)
      || principalPaise < selectedProduct.minPrincipalPaise
      || principalPaise > selectedProduct.maxPrincipalPaise
      || !Number.isInteger(tenure)
      || tenure < selectedProduct.minTenureMonths
      || tenure > selectedProduct.maxTenureMonths
    ) return null;

    return generateAmortizationSchedule({
      principalPaise,
      annualRatePercent: selectedProduct.annualInterestRatePercent,
      installments: installmentCount(tenure, selectedProduct.frequency),
      frequency: selectedProduct.frequency,
      dayCountBasis: selectedProduct.dayCountBasis,
      startDate: new Date(),
    }).installmentAmountPaise;
  }, [principalRupees, selectedProduct, tenureMonths]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    const form = new FormData(formElement);
    try {
      await send("/api/loans", "POST", {
        productId: form.get("productId"),
        borrowerId: role === "user" ? undefined : form.get("borrowerId"),
        principalRupees: Number(form.get("principalRupees")),
        householdMonthlyIncomeRupees: Number(form.get("householdMonthlyIncomeRupees")),
        existingMonthlyDebtRupees: Number(form.get("existingMonthlyDebtRupees")),
        tenureMonths: Number(form.get("tenureMonths")),
        groupId: form.get("groupId") || undefined,
      });
      formElement.reset();
      setProductId("");
      setPrincipalRupees("");
      setTenureMonths("");
      setOpen(false);
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Application could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dfe9e2] bg-white">
      <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => setOpen(!open)} type="button">
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><Plus className="h-4 w-4" /></span>
          <span><span className="block text-sm font-semibold text-[#24463a]">Create a loan application</span><span className="mt-1 block text-xs text-[#8a9992]">Start a new application using an approved loan product</span></span>
        </span>
        <span className="text-xs font-semibold text-[#4c8062]">{open ? "Close" : "New application"}</span>
      </button>
      {open && (
        <form className="grid gap-4 border-t border-[#edf1ee] bg-[#fbfcfb] p-5 sm:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
          {role !== "user" && (
            <label className="text-xs font-semibold text-[#526d61]">Borrower
              <select className="form-control" name="borrowerId" required>
                <option value="">Select customer</option>
                {(usersData?.users ?? []).filter((user) => user.role === "user" && user._id).map((user) => <option key={user._id} value={user._id}>{user.name} · {user.email}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs font-semibold text-[#526d61]">Loan product
            <select className="form-control" name="productId" onChange={(event) => setProductId(event.target.value)} required value={productId}>
              <option value="">Select product</option>
              {(productsData?.products ?? []).map((product) => <option key={product._id} value={product._id}>{product.name} · {product.annualInterestRatePercent}%</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#526d61]">Principal (₹)
            <input className="form-control" max={selectedProduct ? selectedProduct.maxPrincipalPaise / 100 : undefined} min={selectedProduct ? selectedProduct.minPrincipalPaise / 100 : "1"} name="principalRupees" onChange={(event) => setPrincipalRupees(event.target.value)} placeholder="25,000" required step="0.01" type="number" value={principalRupees} />
          </label>
          <label className="text-xs font-semibold text-[#526d61]">Tenure (months)
            <input className="form-control" max={selectedProduct?.maxTenureMonths ?? 120} min={selectedProduct?.minTenureMonths ?? 1} name="tenureMonths" onChange={(event) => setTenureMonths(event.target.value)} placeholder="12" required step="1" type="number" value={tenureMonths} />
          </label>
          <label className="text-xs font-semibold text-[#526d61]">Estimated EMI / installment
            <input
              aria-live="polite"
              className="form-control"
              readOnly
              value={installmentAmountPaise === null
                ? ""
                : `${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(installmentAmountPaise / 100)} / ${selectedProduct?.frequency.toLowerCase()}`}
              placeholder="Select product, principal, and tenure"
            />
          </label>
          <label className="text-xs font-semibold text-[#526d61]">Household income / month (₹)
            <input className="form-control" min="1" name="householdMonthlyIncomeRupees" placeholder="30,000" required step="1" type="number" />
          </label>
          <label className="text-xs font-semibold text-[#526d61]">Other monthly debt (₹)
            <input className="form-control" min="0" name="existingMonthlyDebtRupees" placeholder="0" required step="0.01" type="number" />
          </label>
          {role !== "user" && <label className="text-xs font-semibold text-[#526d61]">JLG group (optional)
            <select className="form-control" name="groupId"><option value="">No group</option>{(groupsData?.groups ?? []).map((group) => <option key={group._id} value={group._id}>{group.name} · {group.centerName}</option>)}</select>
          </label>}
          <div className="flex items-end">
            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60" disabled={busy || !productsData?.products.length || (role !== "user" && !usersData?.users.length)} type="submit">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? "Saving…" : "Submit application"}
            </button>
          </div>
          {error && <div className="sm:col-span-2 xl:col-span-5"><InlineMessage message={error} /></div>}
          {!productsData?.products.length && <p className="sm:col-span-2 xl:col-span-5 text-xs text-[#a07d39]">An administrator must configure an active loan product before applications can be created.</p>}
          <p className="sm:col-span-2 xl:col-span-5 text-[11px] text-[#85938c]">Affordability uses self-declared household income and external debt plus estimated payments on this organization’s active loans. Verify these figures through approved bureau and onboarding workflows before any real lending decision.</p>
        </form>
      )}
    </section>
  );
}
