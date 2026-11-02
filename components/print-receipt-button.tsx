"use client";

import type { ReactNode } from "react";

export default function PrintReceiptButton({ children }: { children: ReactNode }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-lg border border-[#dfe8e1] px-3 py-2 text-sm font-medium text-[#547061] hover:bg-[#f4f8f4]" onClick={() => window.print()} type="button">
      {children}
    </button>
  );
}
