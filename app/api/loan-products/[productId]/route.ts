import mongoose from "mongoose";
import { apiFailure, jsonError, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin } from "@/lib/roles";
import { parseLoanProductInput } from "@/lib/loan-product";
import Loan from "@/models/Loan";
import LoanProduct from "@/models/LoanProduct";

type RouteContext = { params: Promise<{ productId: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("Only organization administrators can manage loan products.", 403);

  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");

  try {
    const { productId } = await params;
    if (!mongoose.isValidObjectId(productId)) return jsonError("Loan product identifier is invalid.");
    const productInput = parseLoanProductInput(value);
    await dbConnect();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const product = await LoanProduct.findById(productId).session(session);
        if (!product) throw new TypeError("Loan product not found.");
        if (await Loan.exists({ product: product._id }).session(session)) {
          throw new TypeError("This loan product cannot be edited because a loan application already exists.");
        }
        Object.assign(product, productInput);
        await product.save({ session });
        await recordAudit({
          actorId: actor.id,
          action: "LOAN_PRODUCT_UPDATED",
          targetEntity: "LoanProduct",
          entityId: productId,
          metadata: {
            code: product.code,
            frequency: product.frequency,
            ...(product.paymentWeekday !== undefined ? { paymentWeekday: product.paymentWeekday } : {}),
            ...(product.paymentMonthDate !== undefined ? { paymentMonthDate: product.paymentMonthDate } : {}),
          },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ id: productId, name: productInput.name, code: productInput.code });
  } catch (caught) {
    if (caught instanceof mongoose.Error.ValidationError) return jsonError(caught.message);
    return apiFailure(caught);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("Only organization administrators can manage loan products.", 403);
  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  if (typeof value.isActive !== "boolean") return jsonError("Product status must be true or false.");

  try {
    const { productId } = await params;
    if (!mongoose.isValidObjectId(productId)) return jsonError("Loan product identifier is invalid.");
    await dbConnect();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const product = await LoanProduct.findById(productId).session(session);
        if (!product) throw new TypeError("Loan product not found.");
        product.isActive = value.isActive as boolean;
        await product.save({ session });
        await recordAudit({
          actorId: actor.id,
          action: value.isActive ? "LOAN_PRODUCT_ACTIVATED" : "LOAN_PRODUCT_DEACTIVATED",
          targetEntity: "LoanProduct",
          entityId: productId,
          metadata: { code: product.code, isActive: product.isActive },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ id: productId, isActive: value.isActive });
  } catch (caught) {
    return apiFailure(caught);
  }
}
