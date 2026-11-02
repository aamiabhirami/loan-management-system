"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";
import type { MonthlyCollectionPoint } from "@/lib/portfolio-types";

const HighchartsView = dynamic(() => import("@/components/highcharts-view"), { ssr: false });

export default function PortfolioCharts({
  monthlyCollections,
  statusCounts,
}: {
  monthlyCollections: MonthlyCollectionPoint[];
  statusCounts: Record<string, number>;
}) {
  const collectionsOptions: Highcharts.Options = {
    chart: {
      type: "areaspline",
      backgroundColor: "transparent",
      height: 248,
      spacing: [12, 0, 0, 0],
      style: { fontFamily: "inherit" },
    },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      categories: monthlyCollections.map((point) => point.label),
      lineColor: "#e8eeea",
      tickColor: "transparent",
      labels: { style: { color: "#8a9992", fontSize: "11px" } },
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: "#eef2ef",
      labels: {
        style: { color: "#8a9992", fontSize: "10px" },
        formatter() { return `₹${Number(this.value) >= 100000 ? `${(Number(this.value) / 100000).toFixed(0)}L` : Number(this.value).toLocaleString("en-IN")}`; },
      },
    },
    tooltip: {
      backgroundColor: "#173b33",
      borderColor: "#173b33",
      borderRadius: 8,
      style: { color: "#fff" },
      pointFormatter() {
        return `<b>₹${Number(this.y).toLocaleString("en-IN")}</b>`;
      },
    },
    plotOptions: {
      areaspline: {
        lineWidth: 2.5,
        color: "#4e8a6a",
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, "rgba(78,138,106,0.22)"], [1, "rgba(78,138,106,0.015)"]],
        },
        marker: { enabled: false, states: { hover: { enabled: true, radius: 4 } } },
      },
    },
    series: [{
      type: "areaspline",
      name: "Collections",
      data: monthlyCollections.map((point) => Math.round(point.amountPaise / 100)),
    }],
  };

  const labels: Record<string, string> = {
    PENDING_APPROVAL: "In review",
    APPROVED: "Approved",
    ACTIVE: "Active",
    REJECTED: "Declined",
    CLOSED: "Closed",
    DEFAULTED: "Defaulted",
  };
  const colors: Record<string, string> = {
    PENDING_APPROVAL: "#d8b95e",
    APPROVED: "#76a97f",
    ACTIVE: "#4e8a6a",
    REJECTED: "#c97869",
    CLOSED: "#8da6b2",
    DEFAULTED: "#aa6254",
  };
  const keys = Object.keys(labels).filter((key) => (statusCounts[key] ?? 0) > 0);
  const statusOptions: Highcharts.Options = {
    chart: { type: "bar", backgroundColor: "transparent", height: 248, spacing: [8, 0, 4, 0], style: { fontFamily: "inherit" } },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      categories: keys.map((key) => labels[key]),
      lineColor: "transparent",
      tickLength: 0,
      labels: { style: { color: "#73877e", fontSize: "11px" } },
    },
    yAxis: { title: { text: undefined }, allowDecimals: false, gridLineColor: "#eef2ef", labels: { style: { color: "#95a19c", fontSize: "10px" } } },
    tooltip: { pointFormat: "<b>{point.y}</b> accounts" },
    plotOptions: {
      bar: {
        borderRadius: 5,
        pointWidth: 13,
        groupPadding: 0.17,
        dataLabels: { enabled: true, style: { color: "#668076", fontSize: "10px", textOutline: "none" } },
      },
    },
    series: [{
      type: "bar",
      name: "Accounts",
      data: keys.map((key) => ({ y: statusCounts[key], color: colors[key] })),
    }],
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
      <section className="rounded-2xl border border-[#e7ece8] bg-white p-5">
        <div className="mb-1">
          <h2 className="text-sm font-semibold text-[#24463a]">Collection trend</h2>
          <p className="mt-1 text-xs text-[#8a9992]">Recorded collections over the last six months</p>
        </div>
        <HighchartsView options={collectionsOptions} />
      </section>
      <section className="rounded-2xl border border-[#e7ece8] bg-white p-5">
        <div className="mb-1">
          <h2 className="text-sm font-semibold text-[#24463a]">Loan account mix</h2>
          <p className="mt-1 text-xs text-[#8a9992]">Accounts by lifecycle status</p>
        </div>
        {keys.length
          ? <HighchartsView options={statusOptions} />
          : <div className="grid h-[248px] place-items-center text-sm text-[#98a49f]">No loan accounts to chart yet</div>}
      </section>
    </div>
  );
}
