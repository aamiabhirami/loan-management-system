import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuditView from "@/components/audit-view";
import PageHeading from "@/components/page-heading";
import { requireActor } from "@/lib/authz";
import { isOrganizationAdmin } from "@/lib/roles";

export const metadata: Metadata = { title: "Audit trail" };
export const instant = false;

export default async function AuditPage() {
  const actor = await requireActor();
  if (!isOrganizationAdmin(actor.role)) redirect("/dashboard");
  return (
    <>
      <PageHeading eyebrow="Governance" title="Audit trail" description="Review the application’s immutable operational event history." />
      <AuditView />
    </>
  );
}
