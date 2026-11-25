export function outstandingProcessingFeePaise(
  processingFeePaise: number | undefined,
  processingFeePaidPaise: number | undefined,
) {
  return Math.max(0, (processingFeePaise ?? 0) - (processingFeePaidPaise ?? 0));
}
