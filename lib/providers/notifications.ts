export type NotificationResult = {
  provider: "SANDBOX";
  status: "SANDBOX";
  reference: string;
};

export async function sendCollectionReceipt(input: {
  receiptCode: string;
  phone?: string;
}): Promise<NotificationResult> {
  return {
    provider: "SANDBOX",
    status: "SANDBOX",
    reference: `NOTIFY-${input.receiptCode}`,
  };
}
