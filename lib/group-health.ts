export type GroupHealthStatus = "HEALTHY" | "NEEDS_ATTENTION" | "AT_RISK" | "NOT_RATED";

type RepaymentInstallment = {
  dueDate: Date | string;
  totalDuePaise: number;
  penaltyAssessedPaise: number;
  paidPaise: number;
};

type RepaymentLoan = {
  status: string;
  disbursedAt?: Date | string | null;
  schedule: RepaymentInstallment[];
};

export function getGroupRepaymentHealth(loans: RepaymentLoan[], asOf = new Date()) {
  let amountDuePaise = 0;
  let amountPaidPaise = 0;

  for (const loan of loans) {
    if (loan.status !== "ACTIVE" || !loan.disbursedAt) continue;
    for (const installment of loan.schedule) {
      if (new Date(installment.dueDate).getTime() > asOf.getTime()) continue;
      const installmentDuePaise = Math.max(0, installment.totalDuePaise + installment.penaltyAssessedPaise);
      amountDuePaise += installmentDuePaise;
      amountPaidPaise += Math.min(installmentDuePaise, Math.max(0, installment.paidPaise));
    }
  }

  const repaymentPercent = amountDuePaise > 0
    ? Math.min(100, amountPaidPaise / amountDuePaise * 100)
    : null;
  const status: GroupHealthStatus = repaymentPercent === null
    ? "NOT_RATED"
    : repaymentPercent >= 90
      ? "HEALTHY"
      : repaymentPercent >= 75
        ? "NEEDS_ATTENTION"
        : "AT_RISK";

  return { status, repaymentPercent, amountDuePaise, amountPaidPaise };
}
