import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import dotenv from "dotenv";

if (existsSync(".env.local")) dotenv.config({ path: ".env.local" });

const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL } = process.env;
const suppliedPassword = process.env.ADMIN_PASSWORD;
const generatedPassword = !suppliedPassword;
const ADMIN_PASSWORD = suppliedPassword || randomBytes(24).toString("base64url");

if (!MONGODB_URI || !ADMIN_NAME || !ADMIN_EMAIL) {
  console.error("Set MONGODB_URI, ADMIN_NAME, and ADMIN_EMAIL in the environment or .env.local before bootstrapping.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must contain at least 12 characters.");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL.trim())) {
  console.error("ADMIN_EMAIL must be a valid email address.");
  process.exit(1);
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["user", "privileged", "admin"], required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  isActive: { type: Boolean, default: true },
  phone: { type: String, trim: true, maxlength: 24 },
  address: { type: String, trim: true, maxlength: 500 },
  kycStatus: { type: String, default: "NOT_STARTED" },
  creditConsentAt: Date,
}, { timestamps: true, strict: "throw" });

const auditSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  action: { type: String, required: true, immutable: true },
  targetEntity: { type: String, required: true, immutable: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  metadata: { type: mongoose.Schema.Types.Mixed, immutable: true },
  createdAt: { type: Date, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw" });

const User = mongoose.models.User || mongoose.model("User", userSchema);
const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditSchema);

try {
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  if (await User.exists({ role: "admin" })) {
    throw new Error("An administrator account already exists. Use an existing administrator to provision access.");
  }

  const session = await mongoose.startSession();
  let admin;
  try {
    await session.withTransaction(async () => {
      admin = new User({
        name: ADMIN_NAME.trim(),
        email: ADMIN_EMAIL.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
        role: "admin",
        isActive: true,
      });
      await admin.save({ session });
      await AuditLog.create([{
        actor: admin._id,
        action: "ADMIN_BOOTSTRAPPED",
        targetEntity: "User",
        entityId: admin._id,
        metadata: { role: "admin" },
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  console.log(`Administrator account created for ${admin.email}. Sign in and remove bootstrap credentials from your environment.`);
  if (generatedPassword) {
    console.log(`One-time password (save it now): ${ADMIN_PASSWORD}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Administrator bootstrap failed.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
