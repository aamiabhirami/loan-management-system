import mongoose from "mongoose";
import { apiFailure, jsonError, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin } from "@/lib/roles";
import Group from "@/models/Group";

type RouteContext = { params: Promise<{ groupId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to manage groups.", 403);
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  if (typeof value.isActive !== "boolean") return jsonError("Group status must be true or false.");

  try {
    const { groupId } = await params;
    if (!mongoose.isValidObjectId(groupId)) return jsonError("Group identifier is invalid.");
    await dbConnect();
    const filter = isOrganizationAdmin(actor.role) ? { _id: groupId } : { _id: groupId, assignedOfficer: actor.id };
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const group = await Group.findOne(filter).session(session);
        if (!group) throw new TypeError("Group not found in your access scope.");
        group.isActive = value.isActive as boolean;
        await group.save({ session });
        await recordAudit({
          actorId: actor.id,
          action: group.isActive ? "GROUP_ACTIVATED" : "GROUP_DEACTIVATED",
          targetEntity: "Group",
          entityId: groupId,
          metadata: { name: group.name, isActive: group.isActive },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ id: groupId, isActive: value.isActive });
  } catch (caught) {
    return apiFailure(caught);
  }
}
