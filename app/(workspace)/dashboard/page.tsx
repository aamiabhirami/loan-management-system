import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeIndianRupee,
  CircleAlert,
  Clock3,
  HandCoins,
  Landmark,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import PageHeading from "@/components/page-heading";
import PortfolioCharts from "@/components/portfolio-charts";
import StatCard from "@/components/stat-card";
import { requireActor } from "@/lib/authz";
import { formatRupees } from "@/lib/loan-workflow";
import { getPortfolioOverview } from "@/lib/portfolio";
import { isOrganizationAdmin, roleLabel } from "@/lib/roles";

export const instant = false;

export default async function DashboardPage() {
  const actor = await requireActor();
  const overview = await getPortfolioOverview(actor);
  const { metrics } = overview;
  const firstName = actor.name.split(/\s+/)[0];
  const hasApprovals = isOrganizationAdmin(actor.role) && (metrics.statusCounts.PENDING_APPROVAL ?? 0) > 0;

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Good to see you"
        title={`Welcome back, ${firstName}`}
        description={`${roleLabel(actor.role)} workspace · Here’s your portfolio at a glance.`}
        action={
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#173b33] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#245548]"
            href="/loans"
          >
            <BadgeIndianRupee className="h-4 w-4" />
            New loan application
          </Link>
        }
      />

      {hasApprovals && (
        <Link
          className="flex items-center justify-between rounded-xl border border-[#eedcae] bg-[#fffaf0] px-4 py-3 text-sm text-[#846523]"
          href="/loans?status=PENDING_APPROVAL"
        >
          <span className="flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            {metrics.statusCounts.PENDING_APPROVAL} applications are waiting for review
          </span>
          <span className="flex items-center gap-1 font-semibold">Review queue <ArrowUpRight className="h-4 w-4" /></span>
        </Link>
      )}

      {overview.paymentWarnings.length > 0 && (
        <section aria-label="Upcoming and overdue payments" className="space-y-2">
          {overview.paymentWarnings.map((warning) => {
            const overdue = warning.status === "OVERDUE";
            const days = Math.abs(warning.daysUntilDue);
            return (
              <Link
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${
                  overdue
                    ? "border-[#f0c8c2] bg-[#fff4f2] text-[#a23e35]"
                    : "border-[#eedcae] bg-[#fffaf0] text-[#846523]"
                }`}
                href="/loans"
                key={warning.id}
              >
                <span className="flex items-center gap-2">
                  <CircleAlert className="h-4 w-4 shrink-0" />
                  <span>
                    {actor.role !== "user" && <strong>{warning.borrowerName}: </strong>}
                    {overdue
                      ? `Installment ${warning.installmentNo} is overdue by ${days} ${days === 1 ? "day" : "days"}`
                      : `Installment ${warning.installmentNo} is due ${warning.daysUntilDue === 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`}`}
                    {" · "}{formatRupees(warning.amountPaise)} · {warning.productName}
                  </span>
                </span>
                <span className="font-medium">{new Date(warning.dueDate).toLocaleDateString("en-IN")} <ArrowUpRight className="inline h-4 w-4" /></span>
              </Link>
            );
          })}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Portfolio outstanding"
          value={formatRupees(metrics.outstandingPortfolioPaise)}
          detail={`${metrics.activeLoanCount} active loan accounts`}
          icon={<Landmark className="h-[18px] w-[18px]" />}
          tone="green"
        />
        <StatCard
          label="Collections this month"
          value={formatRupees(metrics.collectedThisMonthPaise)}
          detail="Recorded against due installments"
          icon={<HandCoins className="h-[18px] w-[18px]" />}
          tone="blue"
        />
        <StatCard
          label="Customers"
          value={metrics.customerCount.toLocaleString("en-IN")}
          detail={`${metrics.loanCount} loan applications to date`}
          icon={<UsersRound className="h-[18px] w-[18px]" />}
          tone="green"
        />
        <StatCard
          label="Overdue installments"
          value={formatRupees(metrics.overduePaise)}
          detail="Scheduled amount past due"
          icon={<CircleAlert className="h-[18px] w-[18px]" />}
          tone={metrics.overduePaise ? "amber" : "green"}
        />
      </section>

      <PortfolioCharts
        monthlyCollections={overview.monthlyCollections}
        statusCounts={metrics.statusCounts}
      />

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf1ee] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[#24463a]">Recent loan accounts</h2>
              <p className="mt-1 text-xs text-[#8a9992]">Applications and recently serviced loans</p>
            </div>
            <Link className="text-xs font-semibold text-[#4c8062] hover:text-[#234f39]" href="/loans">View all</Link>
          </div>
          {overview.recentLoans.length ? (
            <div className="divide-y divide-[#f0f3f0]">
              {overview.recentLoans.slice(0, 5).map((loan) => (
                <div className="flex items-center justify-between gap-3 px-5 py-3.5" key={loan.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#29483d]">{loan.borrowerName}</p>
                    <p className="mt-1 truncate text-xs text-[#8a9992]">{loan.productName} · {new Date(loan.createdAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#315444]">{formatRupees(loan.principalPaise)}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      loan.status === "ACTIVE" ? "bg-[#eaf4ed] text-[#397253]"
                        : loan.status === "PENDING_APPROVAL" ? "bg-[#fbf2dc] text-[#9e792c]"
                          : "bg-[#eff2f0] text-[#74837c]"
                    }`}>{loan.status.replaceAll("_", " ").toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#f0f5f1] text-[#71937c]">
                <BadgeIndianRupee className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-[#38594b]">Your first application starts here</p>
              <p className="mt-1 text-xs text-[#89968f]">Create a loan application to start tracking the portfolio.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#e7ece8] bg-white p-5">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-[#24463a]">Risk monitor</h2>
            <p className="mt-1 text-xs text-[#8a9992]">Outstanding principal in accounts past due</p>
          </div>
          <div className="space-y-4">
            {[
              { label: "PAR 30", value: metrics.par30Paise, percent: metrics.par30Percent, tone: "bg-[#dcb34c]" },
              { label: "PAR 60", value: metrics.par60Paise, percent: metrics.par60Percent, tone: "bg-[#d88759]" },
              { label: "PAR 90+", value: metrics.par90Paise, percent: metrics.par90Percent, tone: "bg-[#c46654]" },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#587268]">{item.label}</span>
                  <span className="font-medium text-[#3b594d]">{formatRupees(item.value)} <span className="ml-1 text-[#91a098]">{item.percent.toFixed(1)}%</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eff3ef]">
                  <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${Math.min(100, item.percent)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2 rounded-lg bg-[#f7f8f5] p-3 text-[11px] leading-5 text-[#7b8a82]">
            <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-[#9b8660]" />
            PAR is the outstanding principal for active accounts with at least one installment past due. PAR 90+ is an operational NPA proxy, not a statutory classification.
          </div>
        </div>
      </section>
    </div>
  );
}
