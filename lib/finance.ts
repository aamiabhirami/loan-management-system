export type RepaymentFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
export type DayCountBasis = "ACTUAL_365" | "ACTUAL_360";

export interface ScheduleInput {
  principalPaise: number;
  annualRatePercent: number;
  installments: number;
  frequency: RepaymentFrequency;
  dayCountBasis: DayCountBasis;
  startDate: Date;
  paymentWeekday?: number;
  paymentMonthDate?: number;
}

export interface ScheduledInstallment {
  installmentNo: number;
  dueDate: Date;
  principalDuePaise: number;
  interestDuePaise: number;
  totalDuePaise: number;
  status: "PENDING";
  paidPaise: number;
}

export interface PenaltyInput {
  overdueAmountPaise: number;
  daysPastDue: number;
  graceDays: number;
  fixedFeePaise: number;
  annualRatePercent: number;
  capPaise?: number;
  dayCountBasis: DayCountBasis;
}

function utcDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const firstOfNextMonth = new Date(Date.UTC(year, month + 1, 1));
  const lastDay = new Date(firstOfNextMonth.getTime() - 86_400_000).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function nextDueDate(date: Date, frequency: RepaymentFrequency) {
  if (frequency === "MONTHLY") return addMonths(date, 1);
  const days = frequency === "WEEKLY" ? 7 : 14;
  return new Date(date.getTime() + days * 86_400_000);
}

function monthlyDueDate(date: Date, months: number, day: number) {
  const month = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, normalizedMonth, Math.min(day, lastDay)));
}

function daysBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function interestPaise(balancePaise: number, annualRatePercent: number, days: number, basis: DayCountBasis) {
  return Math.round(balancePaise * (annualRatePercent / 100) * days / (basis === "ACTUAL_360" ? 360 : 365));
}

export function generateAmortizationSchedule(input: ScheduleInput) {
  const {
    principalPaise,
    annualRatePercent,
    installments,
    frequency,
    dayCountBasis,
    startDate,
    paymentWeekday,
    paymentMonthDate,
  } = input;

  if (!Number.isSafeInteger(principalPaise) || principalPaise <= 0) {
    throw new RangeError("Principal must be a positive whole number of paise.");
  }
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent > 100) {
    throw new RangeError("Annual interest rate must be between 0 and 100 percent.");
  }
  if (!Number.isInteger(installments) || installments < 1 || installments > 520) {
    throw new RangeError("Installment count must be between 1 and 520.");
  }
  if (frequency !== "WEEKLY" && frequency !== "FORTNIGHTLY" && frequency !== "MONTHLY") {
    throw new RangeError("Choose a supported repayment frequency.");
  }
  if (paymentWeekday !== undefined
    && (frequency !== "WEEKLY" || !Number.isInteger(paymentWeekday) || paymentWeekday < 0 || paymentWeekday > 6)) {
    throw new RangeError("Choose a valid weekday for weekly repayments.");
  }
  if (paymentMonthDate !== undefined
    && (frequency !== "MONTHLY" || !Number.isInteger(paymentMonthDate) || paymentMonthDate < 1 || paymentMonthDate > 31)) {
    throw new RangeError("Choose a valid day of the month for monthly repayments.");
  }
  if (dayCountBasis !== "ACTUAL_365" && dayCountBasis !== "ACTUAL_360") {
    throw new RangeError("Choose a supported day-count basis.");
  }
  if (!Number.isFinite(startDate.getTime())) throw new RangeError("A valid start date is required.");

  const dates: Date[] = [];
  const anchorDate = utcDate(startDate);
  let date = anchorDate;
  for (let index = 0; index < installments; index += 1) {
    if (frequency === "MONTHLY" && paymentMonthDate !== undefined) {
      date = monthlyDueDate(anchorDate, index + 1, paymentMonthDate);
    } else if (frequency === "WEEKLY" && paymentWeekday !== undefined) {
      const daysUntilPayment = (paymentWeekday - anchorDate.getUTCDay() + 7) % 7 || 7;
      date = new Date(anchorDate.getTime() + (daysUntilPayment + index * 7) * 86_400_000);
    } else {
      date = frequency === "MONTHLY"
        ? addMonths(anchorDate, index + 1)
        : nextDueDate(date, frequency);
    }
    dates.push(date);
  }

  const periods = dates.map((dueDate, index) => {
    const previousDate = index === 0 ? utcDate(startDate) : dates[index - 1];
    return { dueDate, days: daysBetween(previousDate, dueDate) };
  });

  const remainingBalance = (paymentPaise: number) => {
    let balance = principalPaise;
    for (const period of periods) {
      const interest = interestPaise(balance, annualRatePercent, period.days, dayCountBasis);
      balance = Math.max(0, balance + interest - paymentPaise);
    }
    return balance;
  };

  let low = 0;
  let high = principalPaise + interestPaise(
    principalPaise,
    annualRatePercent,
    daysBetween(utcDate(startDate), periods.at(-1)!.dueDate),
    dayCountBasis,
  ) + 1;
  while (remainingBalance(high) > 0) {
    high *= 2;
    if (!Number.isSafeInteger(high)) throw new RangeError("Schedule exceeds supported monetary limits.");
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (remainingBalance(mid) === 0) high = mid;
    else low = mid + 1;
  }

  let balancePaise = principalPaise;
  const schedule: ScheduledInstallment[] = periods.map((period, index) => {
    const interestDuePaise = interestPaise(balancePaise, annualRatePercent, period.days, dayCountBasis);
    const totalDuePaise = index === periods.length - 1
      ? balancePaise + interestDuePaise
      : Math.min(low, balancePaise + interestDuePaise);
    const principalDuePaise = totalDuePaise - interestDuePaise;
    balancePaise = Math.max(0, balancePaise - principalDuePaise);

    return {
      installmentNo: index + 1,
      dueDate: period.dueDate,
      principalDuePaise,
      interestDuePaise,
      totalDuePaise,
      status: "PENDING",
      paidPaise: 0,
    };
  });

  const totalPayablePaise = schedule.reduce((sum, installment) => sum + installment.totalDuePaise, 0);
  return {
    installmentAmountPaise: low,
    totalPayablePaise,
    totalInterestPaise: totalPayablePaise - principalPaise,
    schedule,
  };
}

export function calculateLatePenalty(input: PenaltyInput) {
  if (!Number.isSafeInteger(input.overdueAmountPaise) || input.overdueAmountPaise < 0) {
    throw new RangeError("Overdue amount must be a non-negative whole number of paise.");
  }
  if (!Number.isInteger(input.daysPastDue) || input.daysPastDue < 0
    || !Number.isInteger(input.graceDays) || input.graceDays < 0) {
    throw new RangeError("Days past due and grace days must be non-negative whole numbers.");
  }
  if (!Number.isSafeInteger(input.fixedFeePaise) || input.fixedFeePaise < 0) {
    throw new RangeError("Fixed late fee must be a non-negative whole number of paise.");
  }
  if (!Number.isFinite(input.annualRatePercent) || input.annualRatePercent < 0 || input.annualRatePercent > 100) {
    throw new RangeError("Penalty interest rate must be between 0 and 100 percent.");
  }
  if (input.capPaise !== undefined && (!Number.isSafeInteger(input.capPaise) || input.capPaise < 0)) {
    throw new RangeError("Penalty cap must be a non-negative whole number of paise.");
  }
  if (input.dayCountBasis !== "ACTUAL_365" && input.dayCountBasis !== "ACTUAL_360") {
    throw new RangeError("Choose a supported day-count basis.");
  }

  const overdueDays = Math.max(0, Math.floor(input.daysPastDue) - input.graceDays);
  if (overdueDays === 0 || input.overdueAmountPaise <= 0) return 0;

  const basis = input.dayCountBasis === "ACTUAL_360" ? 360 : 365;
  const fee = input.fixedFeePaise + Math.round(
    input.overdueAmountPaise * (input.annualRatePercent / 100) * overdueDays / basis,
  );
  return input.capPaise === undefined ? fee : Math.min(fee, input.capPaise);
}
