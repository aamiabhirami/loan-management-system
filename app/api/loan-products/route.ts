import mongoose from "mongoose";
import { apiFailure, jsonError, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireApiActor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { isOrganizationAdmin } from "@/lib/roles";
import { parseLoanProductInput } from "@/lib/loan-product";
import Loan from "@/models/Loan";
import LoanProduct from "@/models/LoanProduct";

export async function GET() {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  await dbConnect();
  const products = await LoanProduct.find(isOrganizationAdmin(actor.role) ? {} : { isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  const productsWithEditability = isOrganizationAdmin(actor.role)
    ? await Loan.distinct("product", { product: { $in: products.map((product) => product._id) } }).then((usedProductIds) => {
      const usedProductIdSet = new Set(usedProductIds.map((id) => id.toString()));
      return products.map((product) => ({
        ...product,
        canEdit: !usedProductIdSet.has(product._id.toString()),
      }));
    })
    : products.map((product) => ({ ...product, canEdit: false }));
  return Response.json({ products: productsWithEditability });
}

export async function POST(request: Request) {
  const { actor, response } = await requireApiActor();
  if (response) return response;
  if (!isOrganizationAdmin(actor.role)) return jsonError("Only organization administrators can create loan products.", 403);

  const { value, error } = await readJson(request);
  if (error || !value) return jsonError(error ?? "Invalid request.");
  try {
    const productInput = parseLoanProductInput(value);

    await dbConnect();
    const session = await mongoose.startSession();
    let productId = "";
    try {
      await session.withTransaction(async () => {
        const [product] = await LoanProduct.create([{
          ...productInput,
          createdBy: actor.id,
        }], { session });
        productId = product._id.toString();
        await recordAudit({
          actorId: actor.id,
          action: "LOAN_PRODUCT_CREATED",
          targetEntity: "LoanProduct",
          entityId: productId,
          metadata: {
            code: productInput.code,
            frequency: productInput.frequency,
            ...(productInput.paymentWeekday !== undefined ? { paymentWeekday: productInput.paymentWeekday } : {}),
            ...(productInput.paymentMonthDate !== undefined ? { paymentMonthDate: productInput.paymentMonthDate } : {}),
          },
        }, session);
      });
    } finally {
      await session.endSession();
    }
    return Response.json({ id: productId, name: productInput.name, code: productInput.code }, { status: 201 });
  } catch (caught) {
    if (caught instanceof mongoose.Error.ValidationError) return jsonError(caught.message);
    return apiFailure(caught);
  }
}
