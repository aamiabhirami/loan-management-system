import type { ReactNode } from "react";

export default function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "green" | "amber" | "red" | "blue";
}) {
  const colors = {
    green: "bg-[#eaf4ed] text-[#397253]",
    amber: "bg-[#fbf2dc] text-[#a57c27]",
    red: "bg-[#fbe9e5] text-[#ba5a47]",
    blue: "bg-[#e9f1f7] text-[#4e7898]",
  };
  return (
    <article className="rounded-2xl border border-[#e7ece8] bg-white p-5 shadow-[0_2px_8px_rgba(26,64,50,0.025)]">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-[#72847d]">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[tone]}`}>{icon}</span>
      </div>
      <p className="mt-3 text-[26px] font-semibold tracking-[-0.045em] text-[#193b32]">{value}</p>
      <p className="mt-1 text-xs text-[#87958f]">{detail}</p>
    </article>
  );
}
