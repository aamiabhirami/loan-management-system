"use client";

import { Eye, KeyRound, LoaderCircle, Pencil, Plus, Search, Trash2, UserRoundPlus, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { isOrganizationAdmin, isUserRole, roleLabel, type UserRole } from "@/lib/roles";

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedTo?: { _id: string; name: string } | string | null;
  isActive: boolean;
  phone?: string;
  address?: string;
  customFields?: { label: string; value: string }[];
  kycStatus: string;
  createdAt: string;
};

const ACCOUNT_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: "Customer" },
  { value: "privileged", label: "Field manager / collection agent" },
  { value: "admin", label: "Administrator" },
  { value: "director", label: "Director" },
  { value: "shareholder", label: "Shareholder" },
];

async function request(url: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  return result;
}

export default function CustomersView({ role, teamMode = false }: { role: UserRole; teamMode?: boolean }) {
  const { data, loading, error, reload } = useResource<{ users: UserRow[] }>("/api/users");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [kycBusyId, setKycBusyId] = useState("");
  const [resettingUser, setResettingUser] = useState<UserRow | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetFailure, setResetFailure] = useState("");
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<UserRow | null>(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<{ label: string; value: string }[]>([]);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailFailure, setDetailFailure] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setFailure("");
    setFeedback("");
    const requestedRole = isOrganizationAdmin(role) ? values.get("role") : "user";
    if (!isUserRole(requestedRole)) {
      setFailure("Select a valid account role.");
      return;
    }

    setBusy(true);
    try {
      await request("/api/users", "POST", {
        name: values.get("name"),
        email: values.get("email"),
        password: values.get("password"),
        phone: values.get("phone"),
        role: requestedRole,
        assignedTo: isOrganizationAdmin(role) && teamMode ? values.get("assignedTo") || undefined : undefined,
      });
      form.reset();
      setOpen(false);
      setFeedback(!teamMode && requestedRole !== "user"
        ? `${roleLabel(requestedRole)} account created. Manage it under Team access.`
        : "Account created.");
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

  async function resetUserPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resettingUser) return;
    const values = new FormData(event.currentTarget);
    const passwordValue = values.get("password");
    const confirmation = values.get("confirmPassword");
    if (typeof passwordValue !== "string" || typeof confirmation !== "string") {
      setResetFailure("Enter and confirm the temporary password.");
      return;
    }
    const password = passwordValue.trim();
    if (password.length < 12) {
      setResetFailure("Temporary password must contain at least 12 characters.");
      return;
    }
    if (password !== confirmation.trim()) {
      setResetFailure("The passwords do not match.");
      return;
    }

    setResetBusy(true);
    setResetFailure("");
    setFailure("");
    setFeedback("");
    try {
      await request(`/api/users/${resettingUser._id}/reset-password`, "POST", { password });
      setFeedback(`${resettingUser.name}'s password was reset. Share the temporary password securely.`);
      setResettingUser(null);
    } catch (caught) {
      setResetFailure(caught instanceof Error ? caught.message : "The password could not be reset.");
    } finally {
      setResetBusy(false);
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

  async function openCustomer(user: UserRow, edit = false, confirmRemoval = false) {
    setSelectedCustomer(user);
    setEditingCustomer(edit);
    setFieldDrafts(user.customFields?.map((field) => ({ ...field })) ?? []);
    setDetailBusy(true);
    setDetailFailure("");
    setConfirmDelete(confirmRemoval);
    try {
      const result = await request(`/api/users/${user._id}`, "GET") as { customer: UserRow };
      setSelectedCustomer(result.customer);
      setFieldDrafts(result.customer.customFields?.map((field) => ({ ...field })) ?? []);
    } catch (caught) {
      setDetailFailure(caught instanceof Error ? caught.message : "Customer details could not be loaded.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomer) return;
    const values = new FormData(event.currentTarget);
    let updatedRole: UserRole | undefined;
    if (isOrganizationAdmin(role)) {
      const roleValue = values.get("role");
      if (!isUserRole(roleValue)) {
        setDetailFailure("Select a valid account role.");
        return;
      }
      updatedRole = roleValue;
    }

    const customFields = fieldDrafts
      .map((field) => ({ label: field.label.trim(), value: field.value.trim() }))
      .filter((field) => field.label || field.value);
    if (customFields.some((field) => !field.label || !field.value)) {
      setDetailFailure("Complete or remove each additional field.");
      return;
    }

    setDetailBusy(true);
    setDetailFailure("");
    try {
      await request(`/api/users/${selectedCustomer._id}`, "PATCH", {
        name: values.get("name"),
        email: values.get("email"),
        phone: values.get("phone"),
        address: values.get("address"),
        customFields,
        ...(updatedRole ? { role: updatedRole } : {}),
      });
      if (updatedRole !== undefined && updatedRole !== selectedCustomer.role && updatedRole !== "user") {
        setFeedback(`${roleLabel(updatedRole)} account updated. Manage it under Team access.`);
      } else {
        setFeedback(`${selectedCustomer.name}'s details were updated.`);
      }
      setSelectedCustomer(null);
      await reload();
    } catch (caught) {
      setDetailFailure(caught instanceof Error ? caught.message : "Customer details could not be updated.");
    } finally {
      setDetailBusy(false);
    }
  }

  async function deleteCustomer() {
    if (!selectedCustomer) return;
    setDetailBusy(true);
    setDetailFailure("");
    try {
      await request(`/api/users/${selectedCustomer._id}`, "DELETE");
      setFeedback(`${selectedCustomer.name} was deleted.`);
      setSelectedCustomer(null);
      setConfirmDelete(false);
      await reload();
    } catch (caught) {
      setDetailFailure(caught instanceof Error ? caught.message : "Customer could not be deleted.");
    } finally {
      setDetailBusy(false);
    }
  }

  const accountActions = (user: UserRow) => (
    <div className="flex flex-wrap items-center gap-2">
      {user.role === "user" && !teamMode && <>
        <button aria-label={`View ${user.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-md text-[#668272] hover:bg-[#f1f6f2] hover:text-[#274c38]" onClick={() => openCustomer(user)} title="View customer" type="button"><Eye className="size-4" /></button>
        <button aria-label={`Edit ${user.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-md text-[#668272] hover:bg-[#f1f6f2] hover:text-[#274c38]" onClick={() => openCustomer(user, true)} title="Edit customer" type="button"><Pencil className="size-4" /></button>
        <button aria-label={`Delete ${user.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-md text-[#a34343] hover:bg-[#fbefed]" onClick={() => { void openCustomer(user, false, true); }} title="Delete customer" type="button"><Trash2 className="size-4" /></button>
      </>}
      {isOrganizationAdmin(role) && <button aria-label={`Reset password for ${user.name}`} className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-[#668272] hover:text-[#274c38]" onClick={() => { setResetFailure(""); setResettingUser(user); }} title="Reset password" type="button"><KeyRound className="size-4" /><span>Reset password</span></button>}
      <button className="min-h-11 px-2 text-xs font-semibold text-[#668272] hover:text-[#274c38] disabled:opacity-50" disabled={busyId === user._id} onClick={() => toggleActive(user)} type="button">{busyId === user._id ? "Saving…" : user.isActive ? "Deactivate" : "Reactivate"}</button>
    </div>
  );

  const addAccountLabel = isOrganizationAdmin(role)
    ? teamMode ? "a team account" : "an account"
    : "a customer";

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#dfe9e2] bg-white">
        <button aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-4 text-left sm:px-5" onClick={() => setOpen(!open)} type="button">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><UserRoundPlus className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold text-[#24463a]">Add {addAccountLabel}</span><span className="mt-1 block text-xs leading-5 text-[#8a9992]">Accounts are created by an authorized administrator or field manager</span></span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#4c8062]"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add account</span></span>
        </button>
        {open && (
          <form className="grid gap-4 border-t border-[#edf1ee] bg-[#fbfcfb] p-5 sm:grid-cols-2 xl:grid-cols-4" onSubmit={createUser}>
            <label className="text-xs font-semibold text-[#526d61]">Full name<input className="form-control" maxLength={120} name="name" required /></label>
            <label className="text-xs font-semibold text-[#526d61]">Email<input className="form-control" name="email" required type="email" /></label>
            <label className="text-xs font-semibold text-[#526d61]">Phone (optional)<input className="form-control" maxLength={24} name="phone" type="tel" /></label>
            <label className="text-xs font-semibold text-[#526d61]">Temporary password<input className="form-control" minLength={12} name="password" required type="password" /></label>
            {isOrganizationAdmin(role) && (
              <>
                <label className="text-xs font-semibold text-[#526d61]">Access role
                  <select className="form-control" name="role">{ACCOUNT_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                </label>
                {teamMode && <label className="text-xs font-semibold text-[#526d61]">Assigned field manager
                  <select className="form-control" name="assignedTo"><option value="">Unassigned</option>{managers.map((manager) => <option key={manager._id} value={manager._id}>{manager.name}</option>)}</select>
                </label>}
              </>
            )}
            <div className="flex items-end"><button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60 sm:h-10" disabled={busy} type="submit">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? "Creating…" : "Create account"}</button></div>
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
              : <>
                <div className="divide-y divide-[#edf1ee] sm:hidden">
                  {rows.map((user) => (
                    <article className="space-y-3 p-4" key={user._id}>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-[#29483d]">{user.name}</p>
                        <p className="mt-1 break-all text-xs text-[#8a9992]">{user.email}</p>
                        {user.phone && <p className="mt-1 text-xs text-[#8a9992]">{user.phone}</p>}
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-[#f0f3f0] pt-3 text-xs">
                        <div><dt className="text-[#91a098]">Role</dt><dd className="mt-1 text-[#60776c]">{roleLabel(user.role)}</dd></div>
                        <div><dt className="text-[#91a098]">Assigned to</dt><dd className="mt-1 break-words text-[#74867d]">{typeof user.assignedTo === "object" && user.assignedTo ? user.assignedTo.name : "—"}</dd></div>
                        <div><dt className="text-[#91a098]">KYC review</dt><dd className="mt-1"><select aria-label={`KYC review status for ${user.name}`} className="mt-1 h-10 w-full rounded-lg border border-[#e4ebe6] bg-white px-2 text-xs text-[#60776c] outline-none focus:border-[#6b9a7c]" disabled={kycBusyId === user._id} onChange={(event) => updateKycStatus(user, event.target.value)} value={user.kycStatus}><option value="NOT_STARTED">Not started</option><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option></select></dd></div>
                        <div><dt className="text-[#91a098]">Status</dt><dd className="mt-1"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${user.isActive ? "bg-[#eaf4ed] text-[#397253]" : "bg-[#f2e9e7] text-[#9f5f52]"}`}>{user.isActive ? "Active" : "Inactive"}</span></dd></div>
                      </dl>
                      <div className="border-t border-[#f0f3f0] pt-2">{accountActions(user)}</div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[780px] text-left">
                    <thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]"><tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Assigned to</th><th className="px-5 py-3">KYC review</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead>
                    <tbody className="divide-y divide-[#f0f3f0]">
                      {rows.map((user) => (
                        <tr key={user._id}>
                          <td className="px-5 py-4"><p className="text-sm font-medium text-[#29483d]">{user.name}</p><p className="mt-1 text-xs text-[#8a9992]">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p></td>
                          <td className="px-5 py-4 text-xs text-[#60776c]">{roleLabel(user.role)}</td>
                          <td className="px-5 py-4 text-xs text-[#74867d]">{typeof user.assignedTo === "object" && user.assignedTo ? user.assignedTo.name : "—"}</td>
                          <td className="px-5 py-4"><select aria-label={`KYC review status for ${user.name}`} className="min-h-10 rounded-lg border border-[#e4ebe6] bg-white px-2 py-1.5 text-xs text-[#60776c] outline-none focus:border-[#6b9a7c]" disabled={kycBusyId === user._id} onChange={(event) => updateKycStatus(user, event.target.value)} value={user.kycStatus}><option value="NOT_STARTED">Not started</option><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option></select></td>
                          <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${user.isActive ? "bg-[#eaf4ed] text-[#397253]" : "bg-[#f2e9e7] text-[#9f5f52]"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
                          <td className="px-5 py-4">{accountActions(user)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>}
      </section>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14251f]/45 p-2 sm:p-4" role="presentation">
          <section aria-labelledby="customer-detail-title" aria-modal="true" className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#dfe9e2] bg-white shadow-2xl sm:max-h-[90vh]" role="dialog">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#edf1ee] bg-white px-4 py-4 sm:px-5">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#829189]">Customer record</p><h2 className="mt-1 text-lg font-semibold text-[#24463a]" id="customer-detail-title">{editingCustomer ? "Edit customer" : selectedCustomer.name}</h2></div>
              <button aria-label="Close customer details" className="grid size-8 place-items-center rounded-md text-[#73857b] hover:bg-[#f1f6f2]" onClick={() => setSelectedCustomer(null)} type="button"><X className="size-4" /></button>
            </header>
            {detailFailure && <div className="px-5 pt-4"><InlineMessage message={detailFailure} /></div>}
            {detailBusy && !editingCustomer ? <div className="flex justify-center py-12"><LoaderCircle className="size-5 animate-spin text-[#71937c]" /></div> : editingCustomer ? (
              <form className="space-y-4 p-5" onSubmit={saveCustomer}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#526d61]">Full name<input className="form-control" defaultValue={selectedCustomer.name} maxLength={120} name="name" required /></label>
                  <label className="text-xs font-semibold text-[#526d61]">Email<input className="form-control" defaultValue={selectedCustomer.email} name="email" required type="email" /></label>
                  <label className="text-xs font-semibold text-[#526d61]">Phone<input className="form-control" defaultValue={selectedCustomer.phone ?? ""} maxLength={24} name="phone" type="tel" /></label>
                  <label className="text-xs font-semibold text-[#526d61]">Address<input className="form-control" defaultValue={selectedCustomer.address ?? ""} maxLength={500} name="address" /></label>
                  {isOrganizationAdmin(role) && <label className="text-xs font-semibold text-[#526d61]">Access role
                    <select className="form-control" defaultValue={selectedCustomer.role} name="role">{ACCOUNT_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </label>}
                </div>
                <div className="border-t border-[#edf1ee] pt-4">
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-[#315444]">Additional fields</h3><button className="inline-flex h-8 items-center gap-1 rounded-md border border-[#dfe9e2] px-2.5 text-xs font-semibold text-[#4c8062] hover:bg-[#f5f8f5]" onClick={() => setFieldDrafts([...fieldDrafts, { label: "", value: "" }])} type="button"><Plus className="size-3.5" />Add field</button></div>
                  {fieldDrafts.length === 0 ? <p className="text-xs text-[#8a9992]">No additional fields.</p> : <div className="space-y-2">
                    {fieldDrafts.map((field, index) => <div className="grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1.4fr_auto]" key={`field-${index}`}>
                      <input aria-label={`Field ${index + 1} name`} className="form-control" maxLength={60} onChange={(event) => setFieldDrafts(fieldDrafts.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Field name" value={field.label} />
                      <input aria-label={`Field ${index + 1} value`} className="form-control" maxLength={500} onChange={(event) => setFieldDrafts(fieldDrafts.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder="Value" value={field.value} />
                      <button aria-label={`Remove field ${index + 1}`} className="grid size-9 place-items-center rounded-md text-[#a34343] hover:bg-[#fbefed]" onClick={() => setFieldDrafts(fieldDrafts.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 className="size-4" /></button>
                    </div>)}
                  </div>}
                </div>
                <div className="flex justify-end gap-2 border-t border-[#edf1ee] pt-4"><button className="h-9 rounded-lg border border-[#dfe9e2] px-3 text-xs font-semibold text-[#526d61]" onClick={() => setEditingCustomer(false)} type="button">Cancel</button><button className="h-9 rounded-lg bg-[#173b33] px-4 text-xs font-semibold text-white disabled:opacity-60" disabled={detailBusy} type="submit">{detailBusy ? "Saving…" : "Save changes"}</button></div>
              </form>
            ) : (
              <div className="space-y-5 p-5">
                {detailBusy ? <div className="flex justify-center py-4"><LoaderCircle className="size-5 animate-spin text-[#71937c]" /></div> : <>
                  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div><dt className="text-[10px] font-semibold uppercase text-[#829189]">Email</dt><dd className="mt-1 break-all text-sm text-[#315444]">{selectedCustomer.email}</dd></div>
                    <div><dt className="text-[10px] font-semibold uppercase text-[#829189]">Phone</dt><dd className="mt-1 text-sm text-[#315444]">{selectedCustomer.phone || "—"}</dd></div>
                    <div><dt className="text-[10px] font-semibold uppercase text-[#829189]">Address</dt><dd className="mt-1 text-sm text-[#315444]">{selectedCustomer.address || "—"}</dd></div>
                    <div><dt className="text-[10px] font-semibold uppercase text-[#829189]">KYC review</dt><dd className="mt-1 text-sm text-[#315444]">{selectedCustomer.kycStatus.replaceAll("_", " ").toLowerCase()}</dd></div>
                  </dl>
                  {selectedCustomer.customFields?.length ? <div className="border-t border-[#edf1ee] pt-4"><h3 className="mb-3 text-sm font-semibold text-[#315444]">Additional fields</h3><dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{selectedCustomer.customFields.map((field) => <div key={field.label}><dt className="text-[10px] font-semibold uppercase text-[#829189]">{field.label}</dt><dd className="mt-1 break-words text-sm text-[#315444]">{field.value}</dd></div>)}</dl></div> : null}
                </>}
                {confirmDelete ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1ee] pt-4"><p className="text-xs text-[#9f463f]">Permanently delete this customer? Linked records will prevent deletion.</p><div className="flex gap-2"><button className="h-9 rounded-lg border border-[#dfe9e2] px-3 text-xs font-semibold text-[#526d61]" onClick={() => setConfirmDelete(false)} type="button">Cancel</button><button className="h-9 rounded-lg bg-[#a34343] px-3 text-xs font-semibold text-white disabled:opacity-60" disabled={detailBusy} onClick={() => { void deleteCustomer(); }} type="button">{detailBusy ? "Deleting…" : "Delete customer"}</button></div></div> : <div className="flex justify-end gap-2 border-t border-[#edf1ee] pt-4"><button className="h-9 rounded-lg border border-[#dfe9e2] px-3 text-xs font-semibold text-[#a34343]" onClick={() => setConfirmDelete(true)} type="button"><Trash2 className="mr-1 inline size-3.5" />Delete</button><button className="h-9 rounded-lg bg-[#173b33] px-3 text-xs font-semibold text-white" onClick={() => setEditingCustomer(true)} type="button"><Pencil className="mr-1 inline size-3.5" />Edit customer</button></div>}
              </div>
            )}
          </section>
        </div>
      )}

      {resettingUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#14251f]/45 p-2 sm:p-4" role="presentation">
          <section aria-labelledby="reset-password-title" aria-modal="true" className="w-full max-w-lg overflow-hidden rounded-xl border border-[#dfe9e2] bg-white shadow-2xl" role="dialog">
            <header className="flex items-start justify-between gap-3 border-b border-[#edf1ee] px-4 py-4 sm:px-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#829189]">Account security</p>
                <h2 className="mt-1 text-lg font-semibold text-[#24463a]" id="reset-password-title">Reset password</h2>
                <p className="mt-1 text-xs text-[#8a9992]">{resettingUser.name} · {resettingUser.email}</p>
              </div>
              <button aria-label="Close password reset" className="grid size-8 place-items-center rounded-md text-[#73857b] hover:bg-[#f1f6f2] disabled:opacity-50" disabled={resetBusy} onClick={() => { setResettingUser(null); setResetFailure(""); }} type="button"><X className="size-4" /></button>
            </header>
            <form className="space-y-4 p-5" onSubmit={resetUserPassword}>
              <label className="block text-xs font-semibold text-[#526d61]">Temporary password<input autoComplete="new-password" className="form-control" maxLength={128} minLength={12} name="password" required type="password" /></label>
              <label className="block text-xs font-semibold text-[#526d61]">Confirm temporary password<input autoComplete="new-password" className="form-control" maxLength={128} minLength={12} name="confirmPassword" required type="password" /></label>
              <p className="text-[11px] leading-5 text-[#85938c]">Use at least 12 characters and share the temporary password securely. The user can change it in Account settings.</p>
              {resetFailure && <InlineMessage message={resetFailure} />}
              <div className="flex justify-end gap-2 border-t border-[#edf1ee] pt-4">
                <button className="h-9 rounded-lg border border-[#dfe9e2] px-3 text-xs font-semibold text-[#526d61] disabled:opacity-50" disabled={resetBusy} onClick={() => { setResettingUser(null); setResetFailure(""); }} type="button">Cancel</button>
                <button className="flex h-9 items-center gap-2 rounded-lg bg-[#173b33] px-4 text-xs font-semibold text-white disabled:opacity-60" disabled={resetBusy} type="submit">{resetBusy && <LoaderCircle className="size-4 animate-spin" />}{resetBusy ? "Resetting…" : "Reset password"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
