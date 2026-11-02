import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowUpRight, CircleAlert, ShieldAlert } from "lucide-react";
import PageHeading from "@/components/page-heading";
import PortfolioCharts from "@/components/portfolio-charts";
import StatCard from "@/components/stat-card";
import { requireActor } from "@/lib/authz";
import { formatRupees } from "@/lib/loan-workflow";
import { getPortfolioOverview } from "@/lib/portfolio";

export const metadata: Metadata = { title: "Portfolio reports" };
export const instant = false;

export default async function ReportsPage() {
  const actor = await requireActor();
  if (actor.role === "user") redirect("/dashboard");
  const overview = await getPortfolioOverview(actor);
  const { metrics } = overview;

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Portfolio intelligence" title="Portfolio reports" description="Aging, risk, collections, and account lifecycle indicators." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding principal" value={formatRupees(metrics.outstandingPortfolioPaise)} detail={`${metrics.activeLoanCount} active accounts`} icon={<ArrowUpRight className="h-[18px] w-[18px]" />} />
        <StatCard label="PAR 30" value={formatRupees(metrics.par30Paise)} detail={`${metrics.par30Percent.toFixed(2)}% of outstanding portfolio`} icon={<CircleAlert className="h-[18px] w-[18px]" />} tone={metrics.par30Paise ? "amber" : "green"} />
        <StatCard label="PAR 60" value={formatRupees(metrics.par60Paise)} detail={`${metrics.par60Percent.toFixed(2)}% of outstanding portfolio`} icon={<CircleAlert className="h-[18px] w-[18px]" />} tone={metrics.par60Paise ? "amber" : "green"} />
        <StatCard label="PAR 90+ / NPA proxy" value={formatRupees(metrics.npaProxyPaise)} detail={`${metrics.par90Percent.toFixed(2)}% · operational indicator`} icon={<ShieldAlert className="h-[18px] w-[18px]" />} tone={metrics.npaProxyPaise ? "red" : "green"} />
      </div>
      <PortfolioCharts monthlyCollections={overview.monthlyCollections} statusCounts={metrics.statusCounts} />
      <section className="rounded-2xl border border-[#e8e2ca] bg-[#fffdf7] p-5">
        <h2 className="text-sm font-semibold text-[#6d5d32]">Interpretation and regulatory review</h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-[#867d63]">
          PAR values represent the outstanding principal of active loan accounts with at least one unpaid installment 30, 60, or 90+ days past due. The 90+ day measure is an operational NPA proxy only. Confirm applicable RBI/NBFC/MFI classification, provisioning, restructuring, and reporting requirements with your compliance team before regulatory use.
        </p>
      </section>
    </div>
  );
}
