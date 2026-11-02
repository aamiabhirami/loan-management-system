import "server-only";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin, type UserRole } from "@/lib/roles";
import User from "@/models/User";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedTo: string | null;
};

export async function getActor(): Promise<Actor | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;

  await dbConnect();
  const user = await User.findById(id)
    .select("_id name email role assignedTo isActive")
    .lean();
  if (!user || !user.isActive) return null;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    assignedTo: user.assignedTo?.toString() ?? null,
  };
}

export async function requireActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function requireApiActor() {
  const actor = await getActor();
  if (!actor) return { actor: null, response: Response.json({ error: "Authentication required." }, { status: 401 }) };
  return { actor, response: null };
}

export function hasRole(actor: Actor, roles: UserRole[]) {
  return roles.includes(actor.role);
}

export function denyAccess() {
  notFound();
}

export async function getAccessibleBorrowerIds(actor: Actor) {
  if (isOrganizationAdmin(actor.role)) return null;
  if (actor.role === "user") return [actor.id];

  await dbConnect();
  const assignedUsers = await User.find({ assignedTo: actor.id, role: "user" })
    .select("_id")
    .lean();
  return [actor.id, ...assignedUsers.map((user) => user._id.toString())];
}

export async function canAccessBorrower(actor: Actor, borrowerId: string) {
  if (isOrganizationAdmin(actor.role) || borrowerId === actor.id) return true;
  if (actor.role !== "privileged") return false;

  await dbConnect();
  return Boolean(await User.exists({ _id: borrowerId, assignedTo: actor.id, role: "user" }));
}
