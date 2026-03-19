import type { AutomationAction } from "@shared/messages";

export function isAutomatableUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  return !/^(about:|moz-extension:|view-source:|chrome:)/i.test(url);
}

export function getRequiredFieldError(
  action: AutomationAction,
  selector?: string,
  value?: string,
): string | null {
  const trimmedSelector = selector?.trim();
  const trimmedValue = value?.trim();

  if (action === "getPageInfo") {
    return null;
  }

  if (!trimmedSelector) {
    return "This action requires a CSS selector.";
  }

  if (action === "setValue" && !trimmedValue) {
    return "Set value requires text to insert.";
  }

  return null;
}
