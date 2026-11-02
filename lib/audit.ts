import "server-only";

import mongoose from "mongoose";
import type { ClientSession } from "mongoose";
import AuditLog from "@/models/AuditLog";

type AuditInput = {
  actorId: string;
  action: string;
  targetEntity: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
  ipAddress?: string;
};

export async function recordAudit(input: AuditInput, session?: ClientSession) {
  if (!mongoose.isValidObjectId(input.actorId) || !mongoose.isValidObjectId(input.entityId)) {
    throw new TypeError("Audit events require valid actor and entity identifiers.");
  }

  await AuditLog.create([{
    actor: input.actorId,
    action: input.action,
    targetEntity: input.targetEntity,
    entityId: input.entityId,
    metadata: input.metadata,
    ipAddress: input.ipAddress,
  }], session ? { session } : undefined);
}
