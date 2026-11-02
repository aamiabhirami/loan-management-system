import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageHeading from "@/components/page-heading";
import PayrollView from "@/components/payroll-view";
import { requireActor } from "@/lib/authz";
import { isOrganizationAdmin } from "@/lib/roles";

export const metadata: Metadata = { title: "Payroll" };
export const instant = false;

export default async function PayrollPage() {
  const actor = await requireActor();
  if (!isOrganizationAdmin(actor.role)) redirect("/dashboard");
  return (
    <>
      <PageHeading eyebrow="Administration" title="Payroll" description="Manage director and field-manager/collection-agent payroll records and reports." />
      <PayrollView />
    </>
  );
}
