import mongoose from "mongoose";
import { apiFailure, jsonError, objectIdField, readJson, stringField } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin } from "@/lib/roles";
import Group from "@/models/Group";
import User from "@/models/User";

const meetingDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export async function GET() {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  await dbConnect();
  const filter = isOrganizationAdmin(actor.role) ? {} : { assignedOfficer: actor.id };
  const groups = await Group.find(filter)
    .populate("members", "name phone")
    .populate("assignedOfficer", "name")
    .sort({ createdAt: -1 })
    .lean();
  return Response.json({ groups });
}

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to create groups.", 403);

  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  try {
    const name = stringField(value.name, "Group name", 120);
    const centerName = stringField(value.centerName, "Center name", 120);
    const meetingDay = value.meetingDay === undefined || value.meetingDay === ""
      ? undefined
      : stringField(value.meetingDay, "Meeting day", 12).toUpperCase();
    if (meetingDay && !meetingDays.includes(meetingDay)) throw new TypeError("Choose a valid meeting day.");
    const memberIds = Array.isArray(value.memberIds)
      ? [...new Set(value.memberIds.map((id) => objectIdField(id, "Member id")))]
      : [];
    if (memberIds.length < 2 || memberIds.length > 30) {
      throw new TypeError("A joint-liability group must have between 2 and 30 members.");
    }
    await dbConnect();
    const members = await User.find({ _id: { $in: memberIds }, role: "user", isActive: true })
      .select("_id assignedTo");
    if (members.length !== memberIds.length) throw new TypeError("Every group member must be an active customer.");
    if (actor.role === "privileged" && members.some((member) => member.assignedTo?.toString() !== actor.id)) {
      return jsonError("A field manager can add only assigned customers to a group.", 403);
    }

    const requestedOfficer = isOrganizationAdmin(actor.role) && value.assignedOfficer
      ? objectIdField(value.assignedOfficer, "Assigned officer")
      : actor.id;
    const officer = await User.findOne({ _id: requestedOfficer, role: "privileged", isActive: true }).select("_id");
    if (!officer) throw new TypeError("Assigned officer must be an active field manager.");
    const session = await mongoose.startSession();
    let groupId = "";
    try {
      await session.withTransaction(async () => {
        const [group] = await Group.create([{
          name,
          centerName,
          members: memberIds,
          assignedOfficer: requestedOfficer,
          meetingDay,
        }], { session });
        groupId = group._id.toString();
        await recordAudit({
          actorId: actor.id,
          action: "GROUP_CREATED",
          targetEntity: "Group",
          entityId: groupId,
          metadata: { memberCount: memberIds.length },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ id: groupId, name, centerName }, { status: 201 });
  } catch (caught) {
    return apiFailure(caught);
  }
}
