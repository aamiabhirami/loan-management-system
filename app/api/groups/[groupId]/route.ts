import mongoose from "mongoose";
import { apiFailure, jsonError, objectIdField, readJson, stringField } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin, type UserRole } from "@/lib/roles";
import Group from "@/models/Group";
import Loan from "@/models/Loan";
import User from "@/models/User";
import "@/models/LoanProduct";

type RouteContext = { params: Promise<{ groupId: string }> };

function groupFilter(actor: { id: string; role: UserRole }, groupId: string) {
  return isOrganizationAdmin(actor.role) ? { _id: groupId } : { _id: groupId, assignedOfficer: actor.id };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to view group details.", 403);

  try {
    const { groupId: rawGroupId } = await params;
    if (!mongoose.isValidObjectId(rawGroupId)) return jsonError("Group identifier is invalid.");
    await dbConnect();
    const group = await Group.findOne(groupFilter(actor, rawGroupId))
      .populate("members", "name phone")
      .populate("assignedOfficer", "name")
      .lean();
    if (!group) return jsonError("Group not found in your access scope.", 404);

    const loans = await Loan.find({ group: rawGroupId })
      .populate("borrower", "name")
      .populate("product", "name")
      .select("borrower product principalPaise tenureMonths frequency status schedule disbursedAt")
      .sort({ createdAt: -1 })
      .lean();
    return Response.json({ group, loans });
  } catch (caught) {
    return apiFailure(caught);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to manage groups.", 403);
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");

  try {
    const { groupId: rawGroupId } = await params;
    const groupId = objectIdField(rawGroupId, "Group");
    const hasName = value.name !== undefined;
    const hasCenterName = value.centerName !== undefined;
    const hasMeetingDay = value.meetingDay !== undefined;
    const hasMemberIds = value.memberIds !== undefined;
    const hasAssignedOfficer = value.assignedOfficer !== undefined;
    const hasIsActive = value.isActive !== undefined;
    if (!hasName && !hasCenterName && !hasMeetingDay && !hasMemberIds && !hasAssignedOfficer && !hasIsActive) {
      return jsonError("Provide at least one group field to update.");
    }
    if (hasIsActive && typeof value.isActive !== "boolean") {
      return jsonError("Group status must be true or false.");
    }
    if (hasAssignedOfficer && !isOrganizationAdmin(actor.role)) {
      return jsonError("Only organization administrators can reassign a group.", 403);
    }
    const name = hasName ? stringField(value.name, "Group name", 120) : undefined;
    const centerName = hasCenterName ? stringField(value.centerName, "Center name", 120) : undefined;
    const meetingDay = hasMeetingDay && value.meetingDay !== ""
      ? stringField(value.meetingDay, "Meeting day", 12).toUpperCase()
      : undefined;
    const meetingDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    if (meetingDay && !meetingDays.includes(meetingDay)) throw new TypeError("Choose a valid meeting day.");
    const memberIds = hasMemberIds && Array.isArray(value.memberIds)
      ? [...new Set(value.memberIds.map((id) => objectIdField(id, "Member id")))]
      : undefined;
    if (hasMemberIds && !memberIds) throw new TypeError("Group members must be provided as a list.");
    if (memberIds && (memberIds.length < 2 || memberIds.length > 30)) {
      throw new TypeError("A joint-liability group must have between 2 and 30 members.");
    }
    const assignedOfficerId = hasAssignedOfficer
      ? objectIdField(value.assignedOfficer, "Assigned officer")
      : undefined;

    await dbConnect();
    if (memberIds) {
      const members = await User.find({ _id: { $in: memberIds }, role: "user", isActive: true })
        .select("_id assignedTo");
      if (members.length !== memberIds.length) throw new TypeError("Every group member must be an active customer.");
      if (actor.role === "privileged" && members.some((member) => member.assignedTo?.toString() !== actor.id)) {
        return jsonError("A field manager can add only assigned customers to a group.", 403);
      }
    }
    if (assignedOfficerId) {
      const officer = await User.findOne({ _id: assignedOfficerId, role: "privileged", isActive: true }).select("_id");
      if (!officer) throw new TypeError("Assigned officer must be an active field manager.");
    }

    const filter = groupFilter(actor, groupId);
    const session = await mongoose.startSession();
    let updatedGroupName = "";
    let updatedIsActive = false;
    try {
      await session.withTransaction(async () => {
        const group = await Group.findOne(filter).session(session);
        if (!group) throw new TypeError("Group not found in your access scope.");
        if (memberIds) {
          const loanForRemovedMember = await Loan.exists({
            group: groupId,
            borrower: { $nin: memberIds },
          }).session(session);
          if (loanForRemovedMember) {
            throw new TypeError("A member with a loan application in this group cannot be removed.");
          }
          group.members = memberIds.map((id) => new mongoose.Types.ObjectId(id));
        }
        if (name !== undefined) group.name = name;
        if (centerName !== undefined) group.centerName = centerName;
        if (hasMeetingDay) group.meetingDay = meetingDay;
        if (assignedOfficerId) group.assignedOfficer = new mongoose.Types.ObjectId(assignedOfficerId);
        if (hasIsActive) group.isActive = value.isActive as boolean;
        await group.save({ session });
        updatedGroupName = group.name;
        updatedIsActive = group.isActive;
        await recordAudit({
          actorId: actor.id,
          action: hasIsActive
            ? group.isActive ? "GROUP_ACTIVATED" : "GROUP_DEACTIVATED"
            : "GROUP_UPDATED",
          targetEntity: "Group",
          entityId: groupId,
          metadata: {
            name: group.name,
            isActive: group.isActive,
            memberCount: group.members.length,
          },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ id: groupId, name: updatedGroupName, isActive: updatedIsActive });
  } catch (caught) {
    return apiFailure(caught);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to delete groups.", 403);

  try {
    const { groupId: rawGroupId } = await params;
    const groupId = objectIdField(rawGroupId, "Group");
    await dbConnect();
    const filter = groupFilter(actor, groupId);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const group = await Group.findOne(filter).session(session);
        if (!group) throw new TypeError("Group not found in your access scope.");
        const linkedLoan = await Loan.exists({ group: groupId }).session(session);
        if (linkedLoan) {
          throw new TypeError("This group has loan applications and cannot be deleted. Deactivate it instead.");
        }
        await Group.deleteOne({ _id: groupId }).session(session);
        await recordAudit({
          actorId: actor.id,
          action: "GROUP_DELETED",
          targetEntity: "Group",
          entityId: groupId,
          metadata: { name: group.name },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ id: groupId, deleted: true });
  } catch (caught) {
    return apiFailure(caught);
  }
}
