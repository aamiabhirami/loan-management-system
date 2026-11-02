export type PayComponent = {
  label: string;
  amountPaise: number;
};

export type PayComponentInput = {
  label: string;
  amountRupees: number;
};

export function parsePayComponents(value: unknown, field: string): PayComponentInput[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new TypeError(`${field} must contain no more than 20 line items.`);
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError(`${field} item ${index + 1} is invalid.`);
    }
    const component = item as Record<string, unknown>;
    if (typeof component.label !== "string" || !component.label.trim() || component.label.trim().length > 80) {
      throw new TypeError(`${field} item ${index + 1} needs a label of at most 80 characters.`);
    }
    if (typeof component.amountRupees !== "number" || !Number.isFinite(component.amountRupees)
      || component.amountRupees < 0.01 || component.amountRupees > 100_000_000) {
      throw new TypeError(`${field} item ${index + 1} must be a positive amount no greater than ₹10 crore.`);
    }
    return {
      label: component.label.trim(),
      amountRupees: component.amountRupees,
    };
  });
}

export function calculatePayroll(earnings: PayComponent[], deductions: PayComponent[]) {
  if ([...earnings, ...deductions].some((item) => !Number.isSafeInteger(item.amountPaise) || item.amountPaise < 0)) {
    throw new TypeError("Payroll line items must be non-negative whole amounts in paise.");
  }
  const grossPaise = earnings.reduce((total, item) => total + item.amountPaise, 0);
  const deductionsPaise = deductions.reduce((total, item) => total + item.amountPaise, 0);
  if (!Number.isSafeInteger(grossPaise) || !Number.isSafeInteger(deductionsPaise)) {
    throw new RangeError("Payroll totals exceed the supported currency limit.");
  }
  if (grossPaise <= 0) throw new TypeError("Payroll requires at least one earning amount.");
  if (deductionsPaise > grossPaise) throw new TypeError("Payroll deductions cannot exceed gross earnings.");
  return { grossPaise, deductionsPaise, netPaise: grossPaise - deductionsPaise };
}

export function dateField(value: unknown, field: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${field} must be a valid date.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`${field} must be a valid date.`);
  }
  return date;
}

export function monthRange(value: string | null) {
  const month = value ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new TypeError("Choose a valid payroll month.");
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { month, start, end };
}
