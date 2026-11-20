"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-[#60756e] transition hover:bg-[#edf3f0] hover:text-[#183d33] sm:justify-start"
      onClick={() => signOut({ callbackUrl: "/login" })}
      type="button"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
