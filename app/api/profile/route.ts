import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import {
  apiFailure,
  jsonError,
  optionalStringField,
  readJson,
  stringField,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export async function GET() {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  await dbConnect();
  const profile = await User.findById(actor.id).select("_id name email role phone address").lean();
  return Response.json({ profile });
}

export async function PATCH(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");

  try {
    const name = value.name === undefined ? undefined : stringField(value.name, "Name", 120);
    const phone = value.phone === undefined ? undefined : optionalStringField(value.phone, "Phone", 24);
    const address = value.address === undefined ? undefined : optionalStringField(value.address, "Address", 500);
    let passwordHash: string | undefined;
    if (value.newPassword !== undefined) {
      const currentPassword = stringField(value.currentPassword, "Current password", 128);
      const newPassword = stringField(value.newPassword, "New password", 128);
      if (newPassword.length < 12) throw new TypeError("New password must contain at least 12 characters.");
      await dbConnect();
      const account = await User.findById(actor.id).select("passwordHash");
      if (!account?.passwordHash || !(await bcrypt.compare(currentPassword, account.passwordHash))) {
        return jsonError("Current password is incorrect.", 403);
      }
      passwordHash = await bcrypt.hash(newPassword, 12);
    }
    if (name === undefined && phone === undefined && address === undefined && passwordHash === undefined) {
      throw new TypeError("Provide at least one profile field to update.");
    }

    await dbConnect();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(actor.id).session(session);
        if (!user || !user.isActive) throw new TypeError("Your account is no longer active.");
        if (name !== undefined) user.name = name;
        if (phone !== undefined || value.phone === "") user.phone = phone;
        if (address !== undefined || value.address === "") user.address = address;
        if (passwordHash) user.passwordHash = passwordHash;
        await user.save({ session });
        await recordAudit({
          actorId: actor.id,
          action: "PROFILE_UPDATED",
          targetEntity: "User",
          entityId: actor.id,
          metadata: { passwordChanged: Boolean(passwordHash) },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ message: "Profile updated." });
  } catch (caught) {
    return apiFailure(caught);
  }
}
