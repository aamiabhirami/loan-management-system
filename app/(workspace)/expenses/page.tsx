import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ExpensesView from "@/components/expenses-view";
import PageHeading from "@/components/page-heading";
import { requireActor } from "@/lib/authz";
import { isOrganizationAdmin } from "@/lib/roles";

export const metadata: Metadata = { title: "Business expenses" };
export const instant = false;

export default async function ExpensesPage() {
  const actor = await requireActor();
  if (!isOrganizationAdmin(actor.role)) redirect("/dashboard");
  return (
    <>
      <PageHeading eyebrow="Administration" title="Business expenses" description="Record and review operating costs and private receipt references." />
      <ExpensesView />
    </>
  );
}
