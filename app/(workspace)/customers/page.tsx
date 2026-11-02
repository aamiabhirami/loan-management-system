import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CustomersView from "@/components/customers-view";
import PageHeading from "@/components/page-heading";
import { requireActor } from "@/lib/authz";

export const metadata: Metadata = { title: "Customers" };
export const instant = false;

export default async function CustomersPage() {
  const actor = await requireActor();
  if (actor.role === "user") redirect("/dashboard");
  return (
    <>
      <PageHeading eyebrow="People" title="Customers" description="Manage the customer accounts assigned to your team." />
      <CustomersView role={actor.role} />
    </>
  );
}
