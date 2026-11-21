import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import {
  apiFailure,
  jsonError,
  readJson,
  stringField,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin } from "@/lib/roles";
import User from "@/models/User";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) {
    return jsonError("Only organization administrators can reset passwords.", 403);
  }

  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");

  try {
    const { userId } = await params;
    if (!mongoose.isValidObjectId(userId)) return jsonError("User identifier is invalid.");
    const password = stringField(value.password, "Temporary password", 128);
    if (password.length < 12) throw new TypeError("Temporary password must contain at least 12 characters.");

    await dbConnect();
    const passwordHash = await bcrypt.hash(password, 12);
    const session = await mongoose.startSession();
    let userFound = false;
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(userId).session(session);
        if (!user) {
          userFound = false;
          return;
        }
        userFound = true;
        user.passwordHash = passwordHash;
        await user.save({ session });
        await recordAudit({
          actorId: actor.id,
          action: "USER_PASSWORD_RESET",
          targetEntity: "User",
          entityId: userId,
        }, session);
      });
    } finally {
      await session.endSession();
    }

    if (!userFound) return jsonError("User not found.", 404);
    return Response.json({ message: "Password reset successfully." });
  } catch (caught) {
    return apiFailure(caught);
  }
}
