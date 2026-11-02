import type { ReactNode } from "react";

export default function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-[#688177]">{eyebrow.toUpperCase()}</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-[#17372f]">{title}</h1>
        <p className="mt-1.5 text-sm text-[#788a84]">{description}</p>
      </div>
      {action}
    </div>
  );
}
