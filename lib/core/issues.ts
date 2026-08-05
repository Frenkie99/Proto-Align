export function canResolveIssue(latestVerificationResult: string | null | undefined) {
  return latestVerificationResult === "疑似已解决";
}
