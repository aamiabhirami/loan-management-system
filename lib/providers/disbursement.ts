export type DisbursementResult = {
  mode: "SANDBOX";
  reference: string;
};

export async function initiateDisbursement(input: {
  loanId: string;
  amountPaise: number;
}): Promise<DisbursementResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Live disbursement is not configured. Sandbox disbursements are disabled in production.");
  }

  return {
    mode: "SANDBOX",
    reference: `SBX-DISB-${input.loanId}-${Date.now()}`,
  };
}
