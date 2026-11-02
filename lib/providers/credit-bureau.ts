export type CreditBureauResult = {
  provider: "SANDBOX";
  status: "SANDBOX";
  reference: string;
  checkedAt: Date;
  decisionEligible: false;
};

export interface CreditBureauProvider {
  check(input: { borrowerId: string; loanId: string; consentedAt: Date }): Promise<CreditBureauResult>;
}

export const sandboxCreditBureau: CreditBureauProvider = {
  async check({ loanId }) {
    return {
      provider: "SANDBOX",
      status: "SANDBOX",
      reference: `SBX-${loanId}-${Date.now()}`,
      checkedAt: new Date(),
      decisionEligible: false,
    };
  },
};
