import type { LeadIndicatorDetection } from "@shared/lead";

export interface AlertState {
  lastLeadAlertSignature: string | null;
  lastAdfAlertSignature: string | null;
}

export const DEFAULT_ALERT_STATE: AlertState = {
  lastLeadAlertSignature: null,
  lastAdfAlertSignature: null,
};

export function buildLeadAlertSignature(detection: LeadIndicatorDetection): string {
  return `${new URL(detection.url).origin}|${detection.count}`;
}

export function buildAdfAlertSignature(sourceUrl: string, fingerprint: string): string {
  return `${sourceUrl}|${fingerprint}`;
}

export function shouldDispatchAlert(
  previousSignature: string | null | undefined,
  nextSignature: string,
): boolean {
  return Boolean(nextSignature) && previousSignature !== nextSignature;
}
