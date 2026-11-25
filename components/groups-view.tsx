"use client";

import { Eye, LoaderCircle, Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { getGroupRepaymentHealth } from "@/lib/group-health";
import { isOrganizationAdmin, type UserRole } from "@/lib/roles";

type Person = { _id: string; name: string; email: string; role: UserRole; assignedTo?: string | null };
type GroupMember = { _id: string; name: string; phone?: string };
type Group = {
  _id: string;
  name: string;
  centerName: string;
  members: GroupMember[];
  assignedOfficer: { _id: string; name: string };
  meetingDay?: string;
  isActive: boolean;
  createdAt: string;
};
type GroupLoan = {
  _id: string;
  borrower: { _id: string; name: string };
  product: { name: string };
  principalPaise: number;
  tenureMonths: number;
  frequency: string;
  status: string;
  disbursedAt?: string;
  schedule: {
    dueDate: string;
    totalDuePaise: number;
    penaltyAssessedPaise: number;
    paidPaise: number;
    status: string;
  }[];
};
type GroupOverview = { group: Group; loans: GroupLoan[] };

const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function rupees(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default function GroupsView({ role }: { role: UserRole }) {
  const { data, loading, error, reload } = useResource<{ groups: Group[] }>("/api/groups");
  const { data: usersData } = useResource<{ users: Person[] }>("/api/users");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busyGroup, setBusyGroup] = useState("");
  const [overview, setOverview] = useState<GroupOverview | null>(null);
  const [overviewGroupId, setOverviewGroupId] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewFailure, setOverviewFailure] = useState("");
  const [editingGroupId, setEditingGroupId] = useState("");
  const overviewTriggerRef = useRef<HTMLButtonElement | null>(null);

  const customers = (usersData?.users ?? []).filter((user) => user.role === "user");
  const officers = (usersData?.users ?? []).filter((user) => user.role === "privileged" && user.assignedTo == null);

  useEffect(() => {
    if (!overviewGroupId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [overviewGroupId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          centerName: values.get("centerName"),
          meetingDay: values.get("meetingDay") || undefined,
          assignedOfficer: isOrganizationAdmin(role) ? values.get("assignedOfficer") || undefined : undefined,
          memberIds: values.getAll("memberIds"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Group could not be created.");
      form.reset();
      setOpen(false);
      setFeedback("Joint-liability group created.");
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Group could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function loadOverview(groupId: string, trigger?: HTMLButtonElement) {
    if (trigger) overviewTriggerRef.current = trigger;
    setOverviewGroupId(groupId);
    setOverview(null);
    setOverviewFailure("");
    setOverviewLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`, { cache: "no-store" });
      const result = await response.json() as GroupOverview & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Group overview could not be loaded.");
      setOverview(result);
    } catch (caught) {
      setOverviewFailure(caught instanceof Error ? caught.message : "Group overview could not be loaded.");
    } finally {
      setOverviewLoading(false);
    }
  }

  function closeOverview() {
    setOverviewGroupId("");
    setOverview(null);
    setOverviewFailure("");
    overviewTriggerRef.current?.focus();
  }

  function handleOverviewKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      closeOverview();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function updateGroup(group: Group, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusyGroup(group._id);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch(`/api/groups/${group._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          centerName: values.get("centerName"),
          meetingDay: values.get("meetingDay"),
          memberIds: values.getAll("memberIds"),
          ...(isOrganizationAdmin(role) ? { assignedOfficer: values.get("assignedOfficer") } : {}),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Group could not be updated.");
      setEditingGroupId("");
      setFeedback(`${group.name} updated.`);
      await reload();
      await loadOverview(group._id);
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Group could not be updated.");
    } finally {
      setBusyGroup("");
    }
  }

  async function toggleGroup(group: Group) {
    setBusyGroup(group._id);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch(`/api/groups/${group._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !group.isActive }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Group could not be updated.");
      setFeedback(`${group.name} ${group.isActive ? "deactivated" : "reactivated"}.`);
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Group could not be updated.");
    } finally {
      setBusyGroup("");
    }
  }

  async function deleteGroup(group: Group) {
    if (!window.confirm(`Delete "${group.name}"? Groups with loan applications cannot be deleted.`)) return;
    setBusyGroup(group._id);
    setFailure("");
    setFeedback("");
    try {
      const response = await fetch(`/api/groups/${group._id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Group could not be deleted.");
      if (overviewGroupId === group._id) {
        setOverview(null);
        setOverviewGroupId("");
      }
      setFeedback(`${group.name} deleted.`);
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Group could not be deleted.");
    } finally {
      setBusyGroup("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#dfe9e2] bg-white">
        <button aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-4 text-left sm:px-5" onClick={() => setOpen(!open)} type="button">
          <span className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><UsersRound className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-[#24463a]">Create a JLG group</span><span className="mt-1 block text-xs leading-5 text-[#8a9992]">Organize center meetings and member collections</span></span></span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#4c8062]"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New group</span></span>
        </button>
        {open && (
          <form className="grid gap-4 border-t border-[#edf1ee] bg-[#fbfcfb] p-5 sm:grid-cols-2" onSubmit={submit}>
            <label className="text-xs font-semibold text-[#526d61]">Group name<input className="form-control" maxLength={120} name="name" required /></label>
            <label className="text-xs font-semibold text-[#526d61]">Center name<input className="form-control" maxLength={120} name="centerName" required /></label>
            <label className="text-xs font-semibold text-[#526d61]">Meeting day<select className="form-control" name="meetingDay"><option value="">Not set</option>{weekDays.map((day) => <option key={day} value={day}>{day.toLowerCase()}</option>)}</select></label>
            {isOrganizationAdmin(role) && <label className="text-xs font-semibold text-[#526d61]">Field manager<select className="form-control" name="assignedOfficer" required><option value="">Select field manager</option>{officers.map((officer) => <option key={officer._id} value={officer._id}>{officer.name}</option>)}</select></label>}
            <MemberSelector customers={customers} legend="Group members (select 2–30 customers)" />
            {failure && <div className="sm:col-span-2"><InlineMessage message={failure} /></div>}
            <div className="sm:col-span-2"><button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60 sm:w-auto" disabled={busy || customers.length < 2 || (isOrganizationAdmin(role) && officers.length === 0)} type="submit">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? "Creating…" : "Create group"}</button></div>
          </form>
        )}
      </section>

      {feedback && <InlineMessage message={feedback} tone="success" />}
      {failure && !open && <InlineMessage message={failure} />}
      {error && <InlineMessage message={error} />}
      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
        <div className="border-b border-[#edf1ee] px-5 py-4"><h2 className="text-sm font-semibold text-[#24463a]">Joint-liability groups</h2><p className="mt-1 text-xs text-[#8a9992]">{data?.groups.length ?? 0} groups in your access scope</p></div>
        {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
          : !data?.groups.length ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">No groups yet. Create a group to coordinate community collections.</p>
            : <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 sm:p-5">{data.groups.map((group) => (
              <article className={`min-w-0 rounded-xl border p-4 ${overviewGroupId === group._id ? "border-[#9cbca3]" : "border-[#e8eee9]"}`} key={group._id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="break-words text-sm font-semibold text-[#29483d]">{group.name}</p><p className="mt-1 break-words text-xs text-[#86958e]">{group.centerName}</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${group.isActive ? "bg-[#eaf4ed] text-[#397253]" : "bg-[#f0f1ef] text-[#7e8882]"}`}>{group.isActive ? "Active" : "Inactive"}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-start justify-between gap-2 border-t border-[#eff3ef] pt-3 text-xs"><span className="text-[#7c8c84]">{group.members.length} members{group.meetingDay ? ` · ${group.meetingDay.toLowerCase()}` : ""}</span><span className="break-words font-medium text-[#597564]">{group.assignedOfficer?.name ?? "Assigned officer"}</span></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{group.members.slice(0, 5).map((member) => <span className="max-w-full break-words rounded-full bg-[#f4f7f4] px-2 py-1 text-[10px] text-[#698075]" key={member._id}>{member.name}</span>)}{group.members.length > 5 && <span className="rounded-full bg-[#f4f7f4] px-2 py-1 text-[10px] text-[#698075]">+{group.members.length - 5}</span>}</div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eff3ef] pt-3">
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#dce9df] px-2.5 text-xs font-semibold text-[#477454] hover:bg-[#f3f8f4] disabled:opacity-50" disabled={overviewLoading} onClick={(event) => void loadOverview(group._id, event.currentTarget)} type="button"><Eye className="h-3.5 w-3.5" />View overview</button>
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#e4e9e5] px-2.5 text-xs font-semibold text-[#65786e] hover:bg-[#f7f9f7]" onClick={() => setEditingGroupId(editingGroupId === group._id ? "" : group._id)} type="button"><Pencil className="h-3.5 w-3.5" />Edit</button>
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#f0dfdc] px-2.5 text-xs font-semibold text-[#a55649] hover:bg-[#fff6f4] disabled:opacity-50" disabled={busyGroup === group._id} onClick={() => void deleteGroup(group)} type="button"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                  <button className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-[#668272] hover:bg-[#f3f7f3] disabled:opacity-50" disabled={busyGroup === group._id} onClick={() => void toggleGroup(group)} type="button">{busyGroup === group._id ? "Saving…" : group.isActive ? "Deactivate" : "Reactivate"}</button>
                </div>
                {editingGroupId === group._id && (
                  <form className="mt-4 space-y-3 border-t border-[#eff3ef] pt-4" onSubmit={(event) => void updateGroup(group, event)}>
                    <label className="block text-xs font-semibold text-[#526d61]">Group name<input className="form-control" defaultValue={group.name} maxLength={120} name="name" required /></label>
                    <label className="block text-xs font-semibold text-[#526d61]">Center name<input className="form-control" defaultValue={group.centerName} maxLength={120} name="centerName" required /></label>
                    <label className="block text-xs font-semibold text-[#526d61]">Meeting day<select className="form-control" defaultValue={group.meetingDay ?? ""} name="meetingDay"><option value="">Not set</option>{weekDays.map((day) => <option key={day} value={day}>{day.toLowerCase()}</option>)}</select></label>
                    {isOrganizationAdmin(role) && <label className="block text-xs font-semibold text-[#526d61]">Field manager<select className="form-control" defaultValue={group.assignedOfficer?._id ?? ""} name="assignedOfficer" required><option value="">Select field manager</option>{officers.map((officer) => <option key={officer._id} value={officer._id}>{officer.name}</option>)}</select></label>}
                    <MemberSelector customers={customers} initialMemberIds={group.members.map((member) => member._id)} legend="Group members (select 2–30 customers)" />
                    {failure && <InlineMessage message={failure} />}
                    <div className="flex gap-2"><button className="rounded-md bg-[#173b33] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={busyGroup === group._id} type="submit">{busyGroup === group._id ? "Saving…" : "Save changes"}</button><button className="rounded-md border border-[#e4e9e5] px-3 py-2 text-xs font-semibold text-[#65786e]" onClick={() => setEditingGroupId("")} type="button">Cancel</button></div>
                  </form>
                )}
              </article>
            ))}</div>}
      </section>
      {overviewGroupId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#14251f]/55 p-2 sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeOverview();
          }}
          role="presentation"
        >
          <section
            aria-labelledby="group-overview-title"
            aria-modal="true"
            className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#dfe9e2] bg-white shadow-2xl sm:max-h-[90vh]"
            onKeyDown={handleOverviewKeyDown}
            role="dialog"
            tabIndex={-1}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf1ee] px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#829189]">Group overview</p>
                <h2 className="mt-1 break-words text-lg font-semibold text-[#24463a]" id="group-overview-title">
                  {overview?.group.name ?? data?.groups.find((group) => group._id === overviewGroupId)?.name ?? "Loading group…"}
                </h2>
                <p className="mt-1 break-words text-xs text-[#829189]">
                  {overview?.group.centerName ?? data?.groups.find((group) => group._id === overviewGroupId)?.centerName ?? ""}
                </p>
              </div>
              <button
                aria-label="Close group overview"
                autoFocus
                className="grid size-9 shrink-0 place-items-center rounded-md text-[#73857b] hover:bg-[#f1f6f2]"
                onClick={closeOverview}
                type="button"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <GroupOverviewPanel
                failure={overviewFailure}
                loading={overviewLoading}
                overview={overview?.group._id === overviewGroupId ? overview : null}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MemberSelector({
  customers,
  initialMemberIds = [],
  legend,
}: {
  customers: Person[];
  initialMemberIds?: string[];
  legend: string;
}) {
  return (
    <fieldset className="rounded-xl border border-[#e1e9e3] bg-white p-3 sm:col-span-2">
      <legend className="px-1 text-xs font-semibold text-[#526d61]">{legend}</legend>
      <div className="mt-1 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {customers.map((customer) => <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#5b7568] hover:bg-[#f6f9f6]" key={customer._id}><input className="accent-[#4c8062]" defaultChecked={initialMemberIds.includes(customer._id)} name="memberIds" type="checkbox" value={customer._id} />{customer.name}</label>)}
        {customers.length === 0 && <p className="p-2 text-xs text-[#89968f]">Create or assign customer accounts before creating a group.</p>}
      </div>
    </fieldset>
  );
}

function GroupOverviewPanel({
  overview,
  loading,
  failure,
}: {
  overview: GroupOverview | null;
  loading: boolean;
  failure: string;
}) {
  if (loading) return <div aria-label="Loading group overview" className="flex justify-center py-7" role="status"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>;
  if (failure) return <InlineMessage message={failure} />;
  if (!overview) return null;

  const disbursedLoans = overview.loans.filter((loan) => loan.disbursedAt);
  const totalDisbursed = disbursedLoans.reduce((sum, loan) => sum + loan.principalPaise, 0);
  const totalRepaid = disbursedLoans.reduce((sum, loan) => (
    sum + loan.schedule.reduce((loanSum, installment) => loanSum + installment.paidPaise, 0)
  ), 0);
  const remainingInstallments = disbursedLoans.reduce((sum, loan) => (
    sum + loan.schedule.filter((installment) => installment.status !== "PAID").length
  ), 0);
  const repaymentHealth = getGroupRepaymentHealth(overview.loans);
  const healthStyle = {
    HEALTHY: { label: "Healthy", className: "border-[#d7e8da] bg-[#f1f8f2] text-[#397253]" },
    NEEDS_ATTENTION: { label: "Needs attention", className: "border-[#eedcae] bg-[#fffaf0] text-[#846523]" },
    AT_RISK: { label: "At risk", className: "border-[#f0c8c2] bg-[#fff4f2] text-[#a23e35]" },
    NOT_RATED: { label: "Not rated", className: "border-[#e5ebe6] bg-[#f8faf8] text-[#72827a]" },
  }[repaymentHealth.status];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-[#29483d]">Group loan overview</h3>
        <p className="mt-1 text-[10px] text-[#86958e]">{overview.loans.length} applications · {disbursedLoans.filter((loan) => loan.status === "ACTIVE").length} active loans</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-3">
        <OverviewMetric label="Principal disbursed" value={rupees(totalDisbursed)} />
        <OverviewMetric label="Repayments received" value={rupees(totalRepaid)} />
        <OverviewMetric label="Installments left" value={remainingInstallments.toLocaleString("en-IN")} />
      </dl>
      <section className={`rounded-xl border p-4 ${healthStyle.className}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold">Repayment health</h4>
            <p className="mt-1 text-[10px] leading-4 opacity-80">Based on amounts repaid against installments due to date on active group loans.</p>
          </div>
          <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold">{healthStyle.label}</span>
        </div>
        {repaymentHealth.repaymentPercent === null
          ? <p className="mt-3 text-[10px]">No installments have come due yet.</p>
          : <>
            <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
              <span>{repaymentHealth.repaymentPercent.toFixed(1)}% repaid</span>
              <span>{rupees(repaymentHealth.amountPaidPaise)} of {rupees(repaymentHealth.amountDuePaise)} due</span>
            </div>
            <div
              aria-label="Group repayment rate"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={repaymentHealth.repaymentPercent}
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/70"
              role="progressbar"
            >
              <div className="h-full rounded-full bg-current transition-[width]" style={{ width: `${repaymentHealth.repaymentPercent}%` }} />
            </div>
          </>}
        <p className="mt-3 text-[9px] opacity-75">Healthy: 90%+ · Needs attention: 75–89% · At risk: below 75%</p>
      </section>
      <div className="overflow-x-auto rounded-lg border border-[#e8eee9]">
        <table className="w-full min-w-[560px] text-left text-[10px]">
          <thead className="bg-[#f8faf8] text-[#87968e]">
            <tr><th className="px-3 py-2 font-semibold">Member / loan</th><th className="px-3 py-2 font-semibold">Disbursed</th><th className="px-3 py-2 font-semibold">Repaid</th><th className="px-3 py-2 font-semibold">Installments left</th></tr>
          </thead>
          <tbody className="divide-y divide-[#eff3ef]">
            {overview.group.members.map((member) => {
              const loans = overview.loans.filter((loan) => loan.borrower?._id === member._id);
              const memberDisbursedLoans = loans.filter((loan) => loan.disbursedAt);
              const memberDisbursed = memberDisbursedLoans.reduce((sum, loan) => sum + loan.principalPaise, 0);
              const memberRepaid = memberDisbursedLoans.reduce((sum, loan) => (
                sum + loan.schedule.reduce((loanSum, installment) => loanSum + installment.paidPaise, 0)
              ), 0);
              const memberInstallmentsLeft = memberDisbursedLoans.reduce((sum, loan) => (
                sum + loan.schedule.filter((installment) => installment.status !== "PAID").length
              ), 0);
              return (
                <tr className="align-top text-[#526d61]" key={member._id}>
                  <td className="px-3 py-2.5"><p className="font-semibold text-[#355547]">{member.name}</p>{member.phone && <p className="mt-0.5 text-[#87968e]">{member.phone}</p>}{loans.length > 0 && <p className="mt-1 leading-4 text-[#87968e]">{loans.map((loan) => `${loan.product?.name ?? "Loan"} · ${rupees(loan.principalPaise)} · ${loan.tenureMonths} mo ${loan.frequency.toLowerCase()} · ${loan.status.replaceAll("_", " ").toLowerCase()}`).join("; ")}</p>}</td>
                  <td className="px-3 py-2.5 font-medium">{rupees(memberDisbursed)}</td>
                  <td className="px-3 py-2.5 font-medium">{rupees(memberRepaid)}</td>
                  <td className="px-3 py-2.5">{memberInstallmentsLeft}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] leading-4 text-[#87958e]">Repayments include scheduled principal, interest, and penalties paid. Installments left counts unpaid installments on disbursed loans.</p>
    </div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-[#f7f9f7] p-2"><dt className="text-[#87958e]">{label}</dt><dd className="mt-1 break-words font-semibold text-[#355547]">{value}</dd></div>;
}
