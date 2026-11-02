"use client";

import { LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";
import { roleLabel } from "@/lib/roles";
import type { UserRole } from "@/lib/roles";

type Profile = { name: string; email: string; role: UserRole; phone?: string; address?: string };

export default function ProfileView() {
  const { data, loading, error, reload } = useResource<{ profile: Profile }>("/api/profile");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setFailure("");
    setSuccess("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          phone: values.get("phone"),
          address: values.get("address"),
          currentPassword: values.get("currentPassword") || undefined,
          newPassword: values.get("newPassword") || undefined,
        }),
      });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Profile could not be updated.");
      form.reset();
      setSuccess(result.message ?? "Profile updated.");
      await reload();
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : "Profile could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center rounded-2xl border border-[#e7ece8] bg-white py-14"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>;
  if (error || !data?.profile) return <InlineMessage message={error || "Profile could not be loaded."} />;
  const profile = data.profile;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
      <form className="space-y-4 rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6" onSubmit={submit}>
        <div className="mb-5"><h2 className="text-sm font-semibold text-[#24463a]">Personal information</h2><p className="mt-1 text-xs text-[#8a9992]">Update the contact details linked to your sign-in.</p></div>
        <label className="block text-xs font-semibold text-[#526d61]">Full name<input className="form-control" defaultValue={profile.name} maxLength={120} name="name" required /></label>
        <label className="block text-xs font-semibold text-[#526d61]">Work email<input className="form-control cursor-not-allowed bg-[#f7f9f7]" defaultValue={profile.email} disabled type="email" /></label>
        <label className="block text-xs font-semibold text-[#526d61]">Phone<input className="form-control" defaultValue={profile.phone ?? ""} maxLength={24} name="phone" type="tel" /></label>
        <label className="block text-xs font-semibold text-[#526d61]">Address<input className="form-control" defaultValue={profile.address ?? ""} maxLength={500} name="address" /></label>
        <div className="border-t border-[#edf1ee] pt-5"><h3 className="text-xs font-semibold text-[#526d61]">Change password (optional)</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium text-[#6b7f74]">Current password<input className="form-control" autoComplete="current-password" name="currentPassword" type="password" /></label><label className="text-xs font-medium text-[#6b7f74]">New password<input className="form-control" autoComplete="new-password" minLength={12} name="newPassword" type="password" /></label></div><p className="mt-2 text-[10px] text-[#93a098]">At least 12 characters; your current password is required to change it.</p></div>
        {failure && <InlineMessage message={failure} />}
        {success && <InlineMessage message={success} tone="success" />}
        <button className="flex h-10 items-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-semibold text-white hover:bg-[#245548] disabled:opacity-60" disabled={busy} type="submit">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{busy ? "Saving…" : "Save changes"}</button>
      </form>
      <aside className="rounded-2xl border border-[#e7ece8] bg-white p-5 sm:p-6">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf4ed] text-[#4b7c58]"><ShieldCheck className="h-5 w-5" /></span>
        <h2 className="mt-4 text-sm font-semibold text-[#24463a]">Account access</h2>
        <p className="mt-1 text-xs text-[#8a9992]">Your role controls which customer and operational records you can access.</p>
        <div className="mt-5 rounded-xl bg-[#f7faf7] p-4"><p className="text-[10px] font-semibold tracking-[0.12em] text-[#83948b]">CURRENT ROLE</p><p className="mt-2 text-sm font-semibold capitalize text-[#476653]">{roleLabel(profile.role)}</p></div>
        <div className="mt-4 text-xs leading-5 text-[#84928b]">If you believe your role or account status is incorrect, contact your organization administrator.</div>
      </aside>
    </div>
  );
}
