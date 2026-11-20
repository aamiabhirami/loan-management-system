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
    <div className="mb-6 flex min-w-0 flex-col items-start justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-[#688177]">{eyebrow.toUpperCase()}</p>
        <h1 className="break-words text-2xl font-semibold tracking-[-0.04em] text-[#17372f] sm:text-[28px]">{title}</h1>
        <p className="mt-1.5 text-sm leading-6 text-[#788a84]">{description}</p>
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </div>
  );
}
