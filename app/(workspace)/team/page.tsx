import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CustomersView from "@/components/customers-view";
import PageHeading from "@/components/page-heading";
import { requireActor } from "@/lib/authz";

export const metadata: Metadata = { title: "Team access" };
export const instant = false;

export default async function TeamPage() {
  const actor = await requireActor();
  if (actor.role === "user") redirect("/dashboard");
  return (
    <>
      <PageHeading eyebrow="Administration" title="Team access" description="Provision organization accounts and manage access status." />
      <CustomersView role={actor.role} teamMode />
    </>
  );
}
