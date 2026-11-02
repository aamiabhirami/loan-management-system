"use client";

import { LoaderCircle, Plus, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { isOrganizationAdmin, type UserRole } from "@/lib/roles";

type Person = { _id: string; name: string; email: string; role: UserRole; assignedTo?: string | null };
type Group = {
  _id: string;
  name: string;
  centerName: string;
  members: { _id: string; name: string; phone?: string }[];
  assignedOfficer: { _id: string; name: string };
  meetingDay?: string;
  isActive: boolean;
  createdAt: string;
};

const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export default function GroupsView({ role }: { role: UserRole }) {
  const { data, loading, error, reload } = useResource<{ groups: Group[] }>("/api/groups");
  const { data: usersData } = useResource<{ users: Person[] }>("/api/users");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busyGroup, setBusyGroup] = useState("");

  const customers = (usersData?.users ?? []).filter((user) => user.role === "user");
  const officers = (usersData?.users ?? []).filter((user) => user.role === "privileged" && user.assignedTo == null);

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

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#dfe9e2] bg-white">
        <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => setOpen(!open)} type="button">
          <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><UsersRound className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-[#24463a]">Create a JLG group</span><span className="mt-1 block text-xs text-[#8a9992]">Organize center meetings and member collections</span></span></span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4c8062]"><Plus className="h-4 w-4" />New group</span>
        </button>
        {open && (
          <form className="grid gap-4 border-t border-[#edf1ee] bg-[#fbfcfb] p-5 sm:grid-cols-2" onSubmit={submit}>
            <label className="text-xs font-semibold text-[#526d61]">Group name<input className="form-control" maxLength={120} name="name" required /></label>
            <label className="text-xs font-semibold text-[#526d61]">Center name<input className="form-control" maxLength={120} name="centerName" required /></label>
            <label className="text-xs font-semibold text-[#526d61]">Meeting day<select className="form-control" name="meetingDay"><option value="">Not set</option>{weekDays.map((day) => <option key={day} value={day}>{day.toLowerCase()}</option>)}</select></label>
            {isOrganizationAdmin(role) && <label className="text-xs font-semibold text-[#526d61]">Field manager<select className="form-control" name="assignedOfficer" required><option value="">Select field manager</option>{officers.map((officer) => <option key={officer._id} value={officer._id}>{officer.name}</option>)}</select></label>}
            <fieldset className="rounded-xl border border-[#e1e9e3] bg-white p-3 sm:col-span-2">
              <legend className="px-1 text-xs font-semibold text-[#526d61]">Group members (select 2–30 customers)</legend>
              <div className="mt-1 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {customers.map((customer) => <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#5b7568] hover:bg-[#f6f9f6]" key={customer._id}><input className="accent-[#4c8062]" name="memberIds" type="checkbox" value={customer._id} />{customer.name}</label>)}
                {customers.length === 0 && <p className="p-2 text-xs text-[#89968f]">Create or assign customer accounts before creating a group.</p>}
              </div>
            </fieldset>
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
            : <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{data.groups.map((group) => <article className="rounded-xl border border-[#e8eee9] p-4" key={group._id}><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-[#29483d]">{group.name}</p><p className="mt-1 text-xs text-[#86958e]">{group.centerName}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${group.isActive ? "bg-[#eaf4ed] text-[#397253]" : "bg-[#f0f1ef] text-[#7e8882]"}`}>{group.isActive ? "Active" : "Inactive"}</span></div><div className="mt-4 flex items-center justify-between border-t border-[#eff3ef] pt-3 text-xs"><span className="text-[#7c8c84]">{group.members.length} members{group.meetingDay ? ` · ${group.meetingDay.toLowerCase()}` : ""}</span><span className="font-medium text-[#597564]">{group.assignedOfficer?.name ?? "Assigned officer"}</span></div><div className="mt-3 flex flex-wrap gap-1.5">{group.members.slice(0, 5).map((member) => <span className="rounded-full bg-[#f4f7f4] px-2 py-1 text-[10px] text-[#698075]" key={member._id}>{member.name}</span>)}{group.members.length > 5 && <span className="rounded-full bg-[#f4f7f4] px-2 py-1 text-[10px] text-[#698075]">+{group.members.length - 5}</span>}</div><button className="mt-4 text-[11px] font-semibold text-[#668272] hover:text-[#274c38] disabled:opacity-50" disabled={busyGroup === group._id} onClick={() => toggleGroup(group)} type="button">{busyGroup === group._id ? "Saving…" : group.isActive ? "Deactivate group" : "Reactivate group"}</button></article>)}</div>}
      </section>
    </div>
  );
}
