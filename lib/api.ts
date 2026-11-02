import mongoose from "mongoose";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function readJson(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { value: null, error: "Request body must be a JSON object." };
    }
    return { value: value as Record<string, unknown>, error: null };
  } catch {
    return { value: null, error: "Request body must be valid JSON." };
  }
}

export function stringField(value: unknown, field: string, maxLength = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new TypeError(`${field} is required and must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

export function optionalStringField(value: unknown, field: string, maxLength = 200) {
  if (value === undefined || value === null || value === "") return undefined;
  return stringField(value, field, maxLength);
}

export function numberField(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`${field} must be a number between ${min} and ${max}.`);
  }
  return value;
}

export function objectIdField(value: unknown, field: string) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new TypeError(`${field} must be a valid identifier.`);
  }
  return value;
}

export function apiFailure(error: unknown) {
  if (error instanceof TypeError || error instanceof RangeError) {
    return jsonError(error.message);
  }
  if (error && typeof error === "object" && "code" in error && error.code === 11000) {
    return jsonError("A record with that unique value already exists.", 409);
  }
  if (error && typeof error === "object" && "code" in error && [20, 251].includes(Number(error.code))) {
    return jsonError(transactionUnavailableMessage(), 503);
  }
  console.error("API request failed:", error);
  return jsonError("The request could not be completed. Please try again.", 500);
}

export function transactionUnavailableMessage() {
  return "This operation requires MongoDB transactions. Configure MongoDB as a replica set or use a transaction-capable MongoDB cluster.";
}
