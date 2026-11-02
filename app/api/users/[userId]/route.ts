import mongoose from "mongoose";
import {
  apiFailure,
  jsonError,
  objectIdField,
  optionalStringField,
  readJson,
  stringField,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin, isUserRole } from "@/lib/roles";
import User from "@/models/User";

type RouteContext = { params: Promise<{ userId: string }> };
const kycStatuses = ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"] as const;

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to manage users.", 403);
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");

  try {
    const { userId } = await params;
    if (!mongoose.isValidObjectId(userId)) return jsonError("User identifier is invalid.");
    if (actor.id === userId && (value.isActive === false || value.role !== undefined)) {
      return jsonError("You cannot change your own role or deactivate your account.", 409);
    }
    await dbConnect();
    const filter = isOrganizationAdmin(actor.role)
      ? { _id: userId }
      : { _id: userId, assignedTo: actor.id, role: "user" };
    const existing = await User.findOne(filter);
    if (!existing) return jsonError("User not found in your access scope.", 404);

    if (value.role !== undefined) {
      if (!isOrganizationAdmin(actor.role) || !isUserRole(value.role)) {
        return jsonError("Only administrators can change a user's role.", 403);
      }
      existing.role = value.role;
      if (value.role !== "user") existing.assignedTo = null;
    }
    if (value.name !== undefined) existing.name = stringField(value.name, "Name", 120);
    if (value.phone !== undefined) existing.phone = optionalStringField(value.phone, "Phone", 24);
    if (value.address !== undefined) existing.address = optionalStringField(value.address, "Address", 500);
    if (value.isActive !== undefined) {
      if (typeof value.isActive !== "boolean") throw new TypeError("Account status must be true or false.");
      existing.isActive = value.isActive;
    }
    if (value.kycStatus !== undefined) {
      if (typeof value.kycStatus !== "string" || !kycStatuses.includes(value.kycStatus as (typeof kycStatuses)[number])) {
        throw new TypeError("Choose a supported KYC review status.");
      }
      existing.kycStatus = value.kycStatus as (typeof kycStatuses)[number];
    }
    if (value.assignedTo !== undefined && isOrganizationAdmin(actor.role) && existing.role === "user") {
      const managerId = value.assignedTo === null || value.assignedTo === ""
        ? null
        : objectIdField(value.assignedTo, "Assigned manager");
      if (managerId) {
        const manager = await User.findOne({ _id: managerId, role: "privileged", isActive: true }).select("_id");
        if (!manager) throw new TypeError("Assigned manager must be an active field manager.");
      }
      existing.assignedTo = managerId;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const freshUser = await User.findOne(filter).session(session);
        if (!freshUser) throw new TypeError("User changed while the update was being saved.");
        freshUser.name = existing.name;
        freshUser.phone = existing.phone;
        freshUser.address = existing.address;
        freshUser.isActive = existing.isActive;
        freshUser.kycStatus = existing.kycStatus;
        freshUser.role = existing.role;
        freshUser.assignedTo = existing.assignedTo;
        await freshUser.save({ session });
        await recordAudit({
          actorId: actor.id,
          action: "USER_UPDATED",
          targetEntity: "User",
          entityId: userId,
          metadata: { role: freshUser.role, isActive: freshUser.isActive, kycStatus: freshUser.kycStatus },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({
      user: { id: userId, name: existing.name, role: existing.role, isActive: existing.isActive },
    });
  } catch (caught) {
    return apiFailure(caught);
  }
}
