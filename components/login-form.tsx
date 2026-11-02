"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        email: data.get("email"),
        password: data.get("password"),
        redirect: false,
      });
      if (result?.error) {
        setError("The email or password is incorrect, or the account is inactive.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Sign in could not be completed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block text-sm font-medium text-[#29453e]">
        Work email
        <input
          autoComplete="username"
          className="mt-2 h-12 w-full rounded-xl border border-[#dce5e1] bg-white px-4 text-sm text-[#19362f] outline-none transition placeholder:text-[#9ca9a5] focus:border-[#3b7566] focus:ring-4 focus:ring-[#3b7566]/10"
          name="email"
          placeholder="you@organization.in"
          required
          type="email"
        />
      </label>
      <label className="block text-sm font-medium text-[#29453e]">
        Password
        <input
          autoComplete="current-password"
          className="mt-2 h-12 w-full rounded-xl border border-[#dce5e1] bg-white px-4 text-sm text-[#19362f] outline-none transition placeholder:text-[#9ca9a5] focus:border-[#3b7566] focus:ring-4 focus:ring-[#3b7566]/10"
          name="password"
          placeholder="Enter your password"
          required
          type="password"
        />
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button
        className="h-12 w-full rounded-xl bg-[#173b33] text-sm font-semibold text-white hover:bg-[#245548]"
        disabled={busy}
        type="submit">
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
