import type { Metadata } from "next";
import { redirect } from "next/navigation";
import GroupsView from "@/components/groups-view";
import PageHeading from "@/components/page-heading";
import { requireActor } from "@/lib/authz";

export const metadata: Metadata = { title: "JLG groups" };
export const instant = false;

export default async function GroupsPage() {
  const actor = await requireActor();
  if (actor.role === "user") redirect("/dashboard");
  return (
    <>
      <PageHeading eyebrow="Field operations" title="JLG groups" description="Organize joint-liability groups, centers, and field collection routines." />
      <GroupsView role={actor.role} />
    </>
  );
}
