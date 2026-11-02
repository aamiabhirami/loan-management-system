import type { Metadata } from "next";
import PageHeading from "@/components/page-heading";
import LoansView from "@/components/loans-view";
import { requireActor } from "@/lib/authz";

export const metadata: Metadata = { title: "Loan accounts" };
export const instant = false;

export default async function LoansPage() {
  const actor = await requireActor();
  return (
    <>
      <PageHeading eyebrow="Lending" title="Loan accounts" description="Create, review, and service loan applications in your access scope." />
      <LoansView actorId={actor.id} role={actor.role} />
    </>
  );
}
