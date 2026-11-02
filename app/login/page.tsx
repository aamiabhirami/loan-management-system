import type { Metadata } from "next";
import LoginForm from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[#f4f7f6] lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#102f2a] px-16 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-24 h-[440px] w-[440px] rounded-full border border-white/10" />
        <div className="absolute -right-8 top-12 h-[300px] w-[300px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#c8f169] font-bold text-[#17362f]">M</div>
          <span className="text-lg font-semibold tracking-tight">mitra</span>
        </div>
        <div className="relative max-w-xl pb-14">
          <div className="mb-5 inline-flex rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-[#c8f169]">
            LENDING OPERATIONS, MADE CLEAR
          </div>
          <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight">
            Better visibility.
            <br />
            <span className="text-[#c8f169]">Stronger communities.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/65">
            A thoughtful workspace for responsible lending, transparent collections, and healthier portfolios.
          </p>
        </div>
        <p className="relative text-xs text-white/45">Built for the people who move communities forward.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b33] font-bold text-[#c8f169]">M</div>
            <span className="text-lg font-semibold tracking-tight text-[#173b33]">mitra</span>
          </div>
          <div className="mb-8">
            <p className="text-sm font-semibold text-[#57736a]">WELCOME BACK</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#132f29]">Sign in to Mitra</h2>
            <p className="mt-2 text-sm leading-6 text-[#71827d]">Use your organization account to continue.</p>
          </div>
          <LoginForm />
          <p className="mt-8 text-center text-xs leading-5 text-[#87938f]">
            Access is provisioned by your organization administrator.
            <br />
            Need help? Contact your lending operations team.
          </p>
        </div>
      </section>
    </main>
  );
}
