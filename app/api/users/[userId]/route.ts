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
import Collection from "@/models/Collection";
import CreditCheck from "@/models/CreditCheck";
import CustomerDocument from "@/models/CustomerDocument";
import Group from "@/models/Group";
import Loan from "@/models/Loan";
import User from "@/models/User";

type RouteContext = { params: Promise<{ userId: string }> };
const kycStatuses = ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"] as const;

function parseCustomFields(value: unknown) {
  if (!Array.isArray(value) || value.length > 25) {
    throw new TypeError("Add no more than 25 customer fields.");
  }
  const fields = value.map((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      throw new TypeError("Each customer field needs a name and value.");
    }
    const item = field as Record<string, unknown>;
    return {
      label: stringField(item.label, "Field name", 60),
      value: stringField(item.value, "Field value", 500),
    };
  });
  const labels = fields.map((field) => field.label.toLowerCase());
  if (new Set(labels).size !== labels.length) throw new TypeError("Customer field names must be unique.");
  return fields;
}

function scopedUserFilter(actorId: string, userId: string, isAdmin: boolean) {
  return isAdmin ? { _id: userId, role: "user" } : { _id: userId, assignedTo: actorId, role: "user" };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to view customer records.", 403);
  const { userId } = await params;
  if (!mongoose.isValidObjectId(userId)) return jsonError("User identifier is invalid.");
  await dbConnect();
  const customer = await User.findOne(scopedUserFilter(actor.id, userId, isOrganizationAdmin(actor.role)))
    .select("_id name email phone address customFields role isActive kycStatus createdAt")
    .lean();
  if (!customer) return jsonError("Customer not found in your access scope.", 404);
  return Response.json({ customer });
}

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
    if (value.email !== undefined) {
      const email = stringField(value.email, "Email", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError("Enter a valid email address.");
      existing.email = email;
    }
    if (value.phone !== undefined) existing.phone = optionalStringField(value.phone, "Phone", 24);
    if (value.address !== undefined) existing.address = optionalStringField(value.address, "Address", 500);
    if (value.customFields !== undefined) existing.customFields = parseCustomFields(value.customFields);
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
        freshUser.email = existing.email;
        freshUser.phone = existing.phone;
        freshUser.address = existing.address;
        freshUser.customFields = existing.customFields;
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

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (actor.role === "user") return jsonError("You do not have permission to delete customers.", 403);

  const { userId } = await params;
  if (!mongoose.isValidObjectId(userId)) return jsonError("User identifier is invalid.");

  try {
    await dbConnect();
    const filter = scopedUserFilter(actor.id, userId, isOrganizationAdmin(actor.role));
    const customer = await User.findOne(filter).select("_id name");
    if (!customer) return jsonError("Customer not found in your access scope.", 404);

    const [hasLoans, hasCollections, hasDocuments, hasCreditChecks, hasGroupMemberships] = await Promise.all([
      Loan.exists({ borrower: userId }),
      Collection.exists({ borrower: userId }),
      CustomerDocument.exists({ borrower: userId }),
      CreditCheck.exists({ borrower: userId }),
      Group.exists({ members: userId }),
    ]);
    if (hasLoans || hasCollections || hasDocuments || hasCreditChecks || hasGroupMemberships) {
      return jsonError("This customer has linked loan, collection, document, credit-check, or group records. Deactivate the account to preserve its history.", 409);
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const deleted = await User.findOneAndDelete(filter).session(session);
        if (!deleted) throw new TypeError("Customer changed while deletion was being processed.");
        await recordAudit({
          actorId: actor.id,
          action: "CUSTOMER_DELETED",
          targetEntity: "User",
          entityId: userId,
          metadata: { name: customer.name },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ deleted: true });
  } catch (caught) {
    return apiFailure(caught);
  }
}
