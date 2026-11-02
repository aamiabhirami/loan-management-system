"use client";

import { LoaderCircle } from "lucide-react";
import InlineMessage from "@/components/inline-message";
import { useResource } from "@/components/use-resource";

type AuditEvent = {
  _id: string;
  actor: { name: string; email: string; role: string };
  action: string;
  targetEntity: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export default function AuditView() {
  const { data, loading, error } = useResource<{ events: AuditEvent[] }>("/api/audit");
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
      <div className="border-b border-[#edf1ee] px-5 py-4"><h2 className="text-sm font-semibold text-[#24463a]">Recent system events</h2><p className="mt-1 text-xs text-[#8a9992]">Append-only application records · latest 100 events</p></div>
      {loading ? <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-[#71937c]" /></div>
        : error ? <div className="p-5"><InlineMessage message={error} /></div>
          : !data?.events.length ? <p className="px-5 py-12 text-center text-sm text-[#87958e]">No audit events recorded yet.</p>
            : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#f8faf8] text-[10px] font-semibold uppercase tracking-[0.11em] text-[#87968e]"><tr><th className="px-5 py-3">Event</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Target</th><th className="px-5 py-3">Metadata</th><th className="px-5 py-3">Recorded</th></tr></thead><tbody className="divide-y divide-[#f0f3f0]">{data.events.map((event) => <tr key={event._id}><td className="px-5 py-4"><p className="text-xs font-semibold text-[#405f50]">{event.action.replaceAll("_", " ").toLowerCase()}</p><p className="mt-1 text-[10px] text-[#9aa69f]">{event._id}</p></td><td className="px-5 py-4"><p className="text-xs font-medium text-[#49685b]">{event.actor?.name ?? "Account"}</p><p className="mt-1 text-[10px] text-[#95a19a]">{event.actor?.email ?? ""}</p></td><td className="px-5 py-4"><p className="text-xs font-medium text-[#647d70]">{event.targetEntity}</p><p className="mt-1 text-[10px] text-[#95a19a]">{event.entityId}</p></td><td className="max-w-[260px] px-5 py-4 text-[10px] leading-5 text-[#7d8f85]">{event.metadata ? Object.entries(event.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "—"}</td><td className="whitespace-nowrap px-5 py-4 text-xs text-[#73857b]">{new Date(event.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}</tbody></table></div>}
    </section>
  );
}
