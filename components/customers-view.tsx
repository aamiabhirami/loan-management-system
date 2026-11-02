"use client";

import { LoaderCircle, Plus, Search, UserRoundPlus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { isOrganizationAdmin, roleLabel, type UserRole } from "@/lib/roles";

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedTo?: { _id: string; name: string } | string | null;
  isActive: boolean;
  phone?: string;
  kycStatus: string;
  createdAt: string;
};

async function request(url: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
}

export default function CustomersView({ role, teamMode = false }: { role: UserRole; teamMode?: boolean }) {
  const { data, loading, error, reload } = useResource<{ users: UserRow[] }>("/api/users");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [kycBusyId, setKycBusyId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState("");

  const managers = (data?.users ?? []).filter((user) => user.role === "privileged" && user.isActive);
  const rows = useMemo(() => (data?.users ?? []).filter((user) => {
    const teamMatch = teamMode || user.role === "user";
    const searchMatch = `${user.name} ${user.email} ${user.phone ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return teamMatch && searchMatch;
  }), [data, query, teamMode]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setFailure("");
    setFeedback("");
    try {
      await request("/api/users", "POST", {
        name: values.get("name"),
        email: values.get("email"),
        password: values.get("password"),
        phone: values.get("phone"),
        role: isOrganizationAdmin(role) && teamMode ? values.get("role") : "user",
        assignedTo: isOrganizationAdmin(role) && teamMode ? values.get("assignedTo") || undefined : undefined,
      });
      form.reset();
      setOpen(false);
      setFeedback("Account created.");
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Account could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: UserRow) {
    setBusyId(user._id);
    setFailure("");
    setFeedback("");
    try {
      await request(`/api/users/${user._id}`, "PATCH", { isActive: !user.isActive });
      setFeedback(`${user.name}'s account ${user.isActive ? "deactivated" : "reactivated"}.`);
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Account could not be updated.");
    } finally {
      setBusyId("");
    }
  }

  async function updateKycStatus(user: UserRow, kycStatus: string) {
    setKycBusyId(user._id);
    setFailure("");
    setFeedback("");
    try {
      await request(`/api/users/${user._id}`, "PATCH", { kycStatus });
      setFeedback(`${user.name}'s KYC review status updated.`);
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "KYC review status could not be updated.");
    } finally {
      setKycBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#dfe9e2] bg-white">
        <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => setOpen(!open)} type="button">
          <span className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><UserRoundPlus className="h-4 w-4" /></span>
            <span><span className="block text-sm font-semibold text-[#24463a]">Add {isOrganizationAdmin(role) && teamMode ? "a team account" : "a customer"}</span><span className="mt-1 block text-xs text-[#8a9992]">Accounts are created by an authorized administrator or field manager</span></span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4c8062]"><Plus className="h-4 w-4" />Add account</span>
        </button>
        {open && (
          <form className="grid gap-4 border-t border-[#edf1ee] bg-[#fbfcfb] p-5 sm:grid-cols-2 xl:grid-cols-4" onSubmit={createUser}>
            <label className="text-xs font-semibold text-[#526d61]">Full name<input className="form-control" maxLength={120} name="name" required /></label>
            <label className="text-xs font-semibold text-[#526d61]">Email<input className="form-control" name="email" required type="email" /></label>
            <label className="text-xs font-semibold text-[#526d61]">Phone (optional)<input className="form-control" maxLength={24} name="phone" type="tel" /></label>
            <label className="text-xs font-semibold text-[#526d61]">Temporary password<input className="form-control" minLength={12} name="password" required type="password" /></label>
            {isOrganizationAdmin(role) && teamMode && (
              <>
                <label className="text-xs font-semibold text-[#526d61]">Access role
                  <select className="form-control" name="role"><option value="user">Customer</option><option value="privileged">Field manager / collection agent</option><option value="admin">Administrator</option><option value="director">Director</option><option value="shareholder">Shareholder</option></select>
                </label>
                <label className="text-xs font-semibold text-[#526d61]">Assigned field manager
                  <select className="form-control" name="assignedTo"><option value="">Unassigned</option>{managers.map((manager) => <option key={manager._id} value={manager._id}>{manager.name}</option>)}</select>
                </label>
              </>
            )}
            <div className="flex items-end"><button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60" disabled={busy} type="submit">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? "Creating…" : "Create account"}</button></div>
            <p className="self-end text-[11px] leading-5 text-[#85938c]">Passwords must be at least 12 characters. Share temporary credentials securely.</p>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ee] px-5 py-4">
          <div><h2 className="text-sm font-semibold text-[#24463a]">{teamMode ? "Organization accounts" : "Assigned customers"}</h2><p className="mt-1 text-xs text-[#8a9992]">{rows.length} accounts shown within your access scope</p></div>
          <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-[#e4ebe6] px-3 sm:w-64"><Search className="h-4 w-4 text-[#92a098]" /><input className="w-full bg-transparent text-xs outline-none placeholder:text-[#9ba8a2]" onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" /></label>
        </div>
        {failure && <div className="px-5 pt-4"><InlineMessage message={failure} /></div>}
        {feedback && <div className="px-5 pt-4"><InlineMessage message={feedback} tone="success" /></div>}
        {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
          : error ? <div className="p-5"><InlineMessage message={error} /></div>
            : rows.length === 0 ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">No accounts found. Add an account to get started.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left">
                    <thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]"><tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Assigned to</th><th className="px-5 py-3">KYC review</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead>
                    <tbody className="divide-y divide-[#f0f3f0]">
                      {rows.map((user) => (
                        <tr key={user._id}>
                          <td className="px-5 py-4"><p className="text-sm font-medium text-[#29483d]">{user.name}</p><p className="mt-1 text-xs text-[#8a9992]">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p></td>
                          <td className="px-5 py-4 text-xs text-[#60776c]">{roleLabel(user.role)}</td>
                          <td className="px-5 py-4 text-xs text-[#74867d]">{typeof user.assignedTo === "object" && user.assignedTo ? user.assignedTo.name : "—"}</td>
                          <td className="px-5 py-4"><select aria-label={`KYC review status for ${user.name}`} className="rounded-lg border border-[#e4ebe6] bg-white px-2 py-1.5 text-[10px] text-[#60776c] outline-none focus:border-[#6b9a7c]" disabled={kycBusyId === user._id} onChange={(event) => updateKycStatus(user, event.target.value)} value={user.kycStatus}><option value="NOT_STARTED">Not started</option><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option></select></td>
                          <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${user.isActive ? "bg-[#eaf4ed] text-[#397253]" : "bg-[#f2e9e7] text-[#9f5f52]"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
                          <td className="px-5 py-4"><button className="text-xs font-semibold text-[#668272] hover:text-[#274c38] disabled:opacity-50" disabled={busyId === user._id} onClick={() => toggleActive(user)} type="button">{busyId === user._id ? "Saving…" : user.isActive ? "Deactivate" : "Reactivate"}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      </section>
    </div>
  );
}
