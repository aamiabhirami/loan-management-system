export function storageReferenceField(value: unknown, field = "Storage reference") {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 300) {
    throw new TypeError(`${field} is required and must be at most 300 characters.`);
  }
  const reference = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(reference) || reference.includes("..")) {
    throw new TypeError(`${field} must be a private storage key, not a URL or file path.`);
  }
  return reference;
}
