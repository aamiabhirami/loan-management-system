import "server-only";

import { getAccessibleBorrowerIds, type Actor } from "@/lib/authz";
import dbConnect from "@/lib/db";
import { calculateLatePenalty } from "@/lib/finance";
import { isOrganizationAdmin } from "@/lib/roles";
import Collection from "@/models/Collection";
import Loan, { type IInstallment } from "@/models/Loan";
import LoanProduct from "@/models/LoanProduct";
import User from "@/models/User";

function outstandingPrincipal(loan: {
  schedule: {
    principalDuePaise: number;
    principalPaidPaise: number;
  }[];
}) {
  return loan.schedule.reduce(
    (sum, installment) => sum + Math.max(0, installment.principalDuePaise - installment.principalPaidPaise),
    0,
  );
}

function daysPastDue(dueDate: Date, todayUtc: number) {
  const dueUtc = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  return Math.max(0, Math.floor((todayUtc - dueUtc) / 86_400_000));
}

export async function getPortfolioOverview(actor: Actor) {
  await dbConnect();
  const borrowerIds = await getAccessibleBorrowerIds(actor);
  const loanFilter = borrowerIds ? { borrower: { $in: borrowerIds } } : {};
  const collectionFilter = borrowerIds ? { borrower: { $in: borrowerIds } } : {};
  const loans = await Loan.find(loanFilter)
    .sort({ createdAt: -1 })
    .lean();
  const [customers, products] = await Promise.all([
    User.find({ _id: { $in: loans.map((loan) => loan.borrower) } }).select("_id name").lean(),
    LoanProduct.find({ _id: { $in: loans.map((loan) => loan.product) } })
      .select("_id name graceDays fixedLateFeePaise penaltyAnnualRatePercent penaltyCapPaise dayCountBasis")
      .lean(),
  ]);
  const customerCount = isOrganizationAdmin(actor.role)
    ? await User.countDocuments({ role: "user", isActive: true })
    : actor.role === "privileged"
      ? await User.countDocuments({ role: "user", assignedTo: actor.id, isActive: true })
      : 1;
  const customerNames = new Map(customers.map((customer) => [customer._id.toString(), customer.name]));
  const productNames = new Map(products.map((product) => [product._id.toString(), product.name]));
  const productTerms = new Map(products.map((product) => [product._id.toString(), product]));

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const activeLoans = loans.filter((loan) => loan.status === "ACTIVE");
  const orderedPaymentWarnings = activeLoans.flatMap((loan) => {
    const borrowerName = customerNames.get(loan.borrower.toString()) ?? "Customer";
    const productName = productNames.get(loan.product.toString()) ?? "Loan";
    return (loan.schedule as IInstallment[]).flatMap((installment) => {
      if (installment.status === "PAID") return [];
      const remainingPaise = Math.max(0, installment.totalDuePaise - installment.paidPaise);
      if (remainingPaise === 0) return [];
      const dueDate = new Date(installment.dueDate);
      const dueUtc = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
      const daysUntilDue = Math.round((dueUtc - todayUtc) / 86_400_000);
      if (daysUntilDue > 7) return [];
      return [{
        id: `${loan._id.toString()}-${installment.installmentNo}`,
        borrowerName,
        productName,
        installmentNo: installment.installmentNo,
        dueDate: dueDate.toISOString(),
        daysUntilDue,
        amountPaise: remainingPaise,
        status: daysUntilDue < 0 ? "OVERDUE" as const : "UPCOMING" as const,
      }];
    });
  }).sort((left, right) => (
    left.status === right.status
      ? left.daysUntilDue - right.daysUntilDue
      : left.status === "OVERDUE" ? -1 : 1
  ));
  const paymentWarnings = [
    ...orderedPaymentWarnings.filter((warning) => warning.status === "OVERDUE").slice(0, 10),
    ...orderedPaymentWarnings.filter((warning) => warning.status === "UPCOMING").slice(0, 10),
  ];
  const loanBalances = activeLoans.map((loan) => {
    const schedule = loan.schedule as IInstallment[];
    const terms = productTerms.get(loan.product.toString());
    const maxDaysPastDue = schedule.reduce((maximum, installment) => {
      if (installment.status === "PAID" || installment.dueDate.getTime() >= todayUtc) return maximum;
      return Math.max(maximum, daysPastDue(installment.dueDate, todayUtc));
    }, 0);
    const overduePaise = schedule.reduce((sum, installment) => {
      if (installment.status === "PAID" || installment.dueDate.getTime() >= todayUtc) return sum;
      const outstandingBase = Math.max(
        0,
        installment.principalDuePaise - installment.principalPaidPaise
          + installment.interestDuePaise - installment.interestPaidPaise,
      );
      const accruedPenalty = Math.max(
        installment.penaltyAssessedPaise,
        calculateLatePenalty({
          overdueAmountPaise: outstandingBase,
          daysPastDue: daysPastDue(installment.dueDate, todayUtc),
          graceDays: terms?.graceDays ?? 0,
          fixedFeePaise: terms?.fixedLateFeePaise ?? 0,
          annualRatePercent: terms?.penaltyAnnualRatePercent ?? 0,
          capPaise: terms?.penaltyCapPaise,
          dayCountBasis: terms?.dayCountBasis ?? loan.dayCountBasis,
        }),
      );
      return sum
        + outstandingBase
        + Math.max(0, accruedPenalty - installment.penaltyPaidPaise);
    }, 0);
    return {
      id: loan._id.toString(),
      principalPaise: loan.principalPaise,
      outstandingPrincipalPaise: outstandingPrincipal(loan),
      maxDaysPastDue,
      overduePaise,
    };
  });

  const collectionsSince = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const collections = await Collection.find({
    ...collectionFilter,
    collectedAt: { $gte: collectionsSince },
    status: "RECORDED",
  }).select("amountPaise collectedAt receiptCode borrower").sort({ collectedAt: -1 }).lean();

  const monthLabels = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    return {
      key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`,
      label: new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date),
    };
  });
  const monthlyCollections = monthLabels.map((month) => ({
    label: month.label,
    amountPaise: collections.reduce((sum, collection) => {
      const date = new Date(collection.collectedAt);
      return `${date.getUTCFullYear()}-${date.getUTCMonth()}` === month.key
        ? sum + collection.amountPaise
        : sum;
    }, 0),
  }));

  const outstandingPortfolioPaise = loanBalances.reduce((sum, loan) => sum + loan.outstandingPrincipalPaise, 0);
  const parPrincipal = (threshold: number) => loanBalances
    .filter((loan) => loan.maxDaysPastDue >= threshold)
    .reduce((sum, loan) => sum + loan.outstandingPrincipalPaise, 0);
  const overduePaise = loanBalances.reduce((sum, loan) => sum + loan.overduePaise, 0);
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const collectedThisMonthPaise = collections.reduce((sum, collection) => (
    new Date(collection.collectedAt).getTime() >= monthStart ? sum + collection.amountPaise : sum
  ), 0);

  const statusCounts = loans.reduce<Record<string, number>>((counts, loan) => {
    counts[loan.status] = (counts[loan.status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    metrics: {
      customerCount,
      loanCount: loans.length,
      activeLoanCount: activeLoans.length,
      outstandingPortfolioPaise,
      totalDisbursedPaise: activeLoans.reduce((sum, loan) => sum + loan.principalPaise, 0),
      collectedThisMonthPaise,
      overduePaise,
      par30Paise: parPrincipal(30),
      par60Paise: parPrincipal(60),
      par90Paise: parPrincipal(90),
      npaProxyPaise: parPrincipal(90),
      par30Percent: outstandingPortfolioPaise ? parPrincipal(30) / outstandingPortfolioPaise * 100 : 0,
      par60Percent: outstandingPortfolioPaise ? parPrincipal(60) / outstandingPortfolioPaise * 100 : 0,
      par90Percent: outstandingPortfolioPaise ? parPrincipal(90) / outstandingPortfolioPaise * 100 : 0,
      statusCounts,
    },
    monthlyCollections,
    paymentWarnings,
    recentLoans: loans.slice(0, 8).map((loan) => ({
      id: loan._id.toString(),
      borrowerName: customerNames.get(loan.borrower.toString()) ?? "Customer",
      productName: productNames.get(loan.product.toString()) ?? "Loan",
      principalPaise: loan.principalPaise,
      status: loan.status,
      createdAt: loan.createdAt.toISOString(),
    })),
    recentCollections: collections.slice(0, 6).map((collection) => ({
      receiptCode: collection.receiptCode,
      amountPaise: collection.amountPaise,
      collectedAt: new Date(collection.collectedAt).toISOString(),
    })),
  };
}
