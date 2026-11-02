import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { apiFailure, jsonError, readJson, stringField } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin, isUserRole } from "@/lib/roles";
import User from "@/models/User";

export async function GET() {
  const { actor, response } = await requireApiActor();
  if (response) return response;

  await dbConnect();
  if (actor.role === "user") {
    const ownAccount = await User.findById(actor.id)
      .select("_id name email role assignedTo isActive phone kycStatus createdAt")
      .lean();
    return Response.json({ users: ownAccount ? [ownAccount] : [] });
  }
  const filter = isOrganizationAdmin(actor.role) ? {} : { assignedTo: actor.id, role: "user" };
  const users = await User.find(filter)
    .select("_id name email role assignedTo isActive phone kycStatus createdAt")
    .populate("assignedTo", "name")
    .sort({ createdAt: -1 })
    .lean();
  return Response.json({ users });
}

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to create users.", 403);

  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");

  try {
    const name = stringField(value.name, "Name", 120);
    const email = stringField(value.email, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError("Enter a valid email address.");
    const password = stringField(value.password, "Password", 128);
    if (password.length < 12) throw new TypeError("Password must contain at least 12 characters.");
    const requestedRole = value.role ?? "user";
    if (!isUserRole(requestedRole)) throw new TypeError("Role is not supported.");
    if (!isOrganizationAdmin(actor.role) && requestedRole !== "user") {
      return jsonError("Field managers can create customer accounts only.", 403);
    }

    const assignedTo = requestedRole !== "user"
      ? undefined
      : isOrganizationAdmin(actor.role)
        ? typeof value.assignedTo === "string" && value.assignedTo.trim()
          ? value.assignedTo.trim()
          : undefined
        : actor.id;
    if (assignedTo && !mongoose.isValidObjectId(assignedTo)) throw new TypeError("Assigned manager identifier is invalid.");
    await dbConnect();
    if (assignedTo && assignedTo !== actor.id) {
      const manager = await User.findOne({ _id: assignedTo, role: "privileged", isActive: true }).select("_id");
      if (!manager) throw new TypeError("Assigned manager must be an active field manager.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const session = await mongoose.startSession();
    let createdId = "";
    try {
      await session.withTransaction(async () => {
        const [created] = await User.create([{
          name,
          email,
          passwordHash,
          role: requestedRole,
          assignedTo,
          phone: typeof value.phone === "string" ? value.phone.trim().slice(0, 24) : undefined,
        }], { session });
        createdId = created._id.toString();
        await recordAudit({
          actorId: actor.id,
          action: "USER_CREATED",
          targetEntity: "User",
          entityId: createdId,
          metadata: { role: requestedRole },
        }, session);
      });
    } finally {
      await session.endSession();
    }

    return Response.json({ user: { id: createdId, name, email, role: requestedRole } }, { status: 201 });
  } catch (caught) {
    return apiFailure(caught);
  }
}
