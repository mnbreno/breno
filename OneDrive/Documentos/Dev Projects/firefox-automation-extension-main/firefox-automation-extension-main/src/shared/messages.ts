import type { ExtensionSettings } from "./settings";
import type {
  LeadIndicatorDetection,
  LeadPageContext,
  MatterCustomerSnapshot,
  MatterHistoryImportItem,
} from "./lead";

export type AutomationAction =
  | "getPageInfo"
  | "highlightSelector"
  | "clickSelector"
  | "extractText"
  | "setValue";

export interface AutomationCommand {
  action: AutomationAction;
  selector?: string;
  value?: string;
}

export interface AutomationResult {
  ok: boolean;
  action: AutomationAction;
  data?: Record<string, unknown>;
  error?: string;
}

export interface RunAutomationRequest {
  type: "runAutomation";
  command: AutomationCommand;
}

export interface GetSettingsRequest {
  type: "getSettings";
}

export interface UpdateSettingsRequest {
  type: "updateSettings";
  settings: Partial<ExtensionSettings>;
}

export interface LeadIndicatorDetectedRequest {
  type: "leadIndicatorDetected";
  detection: LeadIndicatorDetection;
}

export interface AdfDetectedRequest {
  type: "adfDetected";
  sourceUrl: string;
  fingerprint: string;
}

export interface CreateTwentyLeadRequest {
  type: "createTwentyLead";
  sourceUrl: string;
  rawAdfs: string[];
  pageContext?: LeadPageContext;
}

export interface CreateTwentyLeadBatchRequest {
  type: "createTwentyLeadBatch";
  sourceUrl: string;
  items: MatterHistoryImportItem[];
  customerSnapshot?: MatterCustomerSnapshot | null;
}

export interface TestTwentyConnectionRequest {
  type: "testTwentyConnection";
}

export type ExtensionRequest =
  | RunAutomationRequest
  | GetSettingsRequest
  | UpdateSettingsRequest
  | LeadIndicatorDetectedRequest
  | AdfDetectedRequest
  | CreateTwentyLeadRequest
  | CreateTwentyLeadBatchRequest
  | TestTwentyConnectionRequest;

function isLeadIndicatorDetection(value: unknown): value is LeadIndicatorDetection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as LeadIndicatorDetection;

  return (
    typeof candidate.url === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.count === "number" &&
    Number.isFinite(candidate.count) &&
    typeof candidate.text === "string" &&
    typeof candidate.seenAt === "string"
  );
}

function isLeadPageContext(value: unknown): value is LeadPageContext {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as LeadPageContext;

  return (
    (candidate.rawSource === null || typeof candidate.rawSource === "string") &&
    (candidate.rawSubSource === null || typeof candidate.rawSubSource === "string") &&
    (candidate.rawUpType === null || typeof candidate.rawUpType === "string") &&
    typeof candidate.normalizedSource === "string"
  );
}

function isMatterHistoryImportItem(value: unknown): value is MatterHistoryImportItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as MatterHistoryImportItem;

  return (
    typeof candidate.sourceUrl === "string" &&
    Array.isArray(candidate.rawAdfs) &&
    candidate.rawAdfs.every((item) => typeof item === "string") &&
    (candidate.title === null || typeof candidate.title === "string") &&
    (candidate.taskId === null || typeof candidate.taskId === "string") &&
    (candidate.completedAt === null || typeof candidate.completedAt === "string") &&
    (candidate.activityType === null || typeof candidate.activityType === "string") &&
    (candidate.outcome === null || typeof candidate.outcome === "string") &&
    (candidate.comment === null || typeof candidate.comment === "string") &&
    (candidate.completedBy === null || typeof candidate.completedBy === "string") &&
    (candidate.pageContext === null || candidate.pageContext === undefined || isLeadPageContext(candidate.pageContext))
  );
}

function isMatterCustomerSnapshot(value: unknown): value is MatterCustomerSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as MatterCustomerSnapshot;

  return (
    (candidate.customerName === null || typeof candidate.customerName === "string") &&
    (candidate.customerFirstName === null || typeof candidate.customerFirstName === "string") &&
    (candidate.customerLastName === null || typeof candidate.customerLastName === "string") &&
    (candidate.customerEmail === null || typeof candidate.customerEmail === "string") &&
    (candidate.customerPhone === null || typeof candidate.customerPhone === "string") &&
    (candidate.customerStreetAddress === null || typeof candidate.customerStreetAddress === "string") &&
    (candidate.customerCity === null || typeof candidate.customerCity === "string") &&
    (candidate.customerState === null || typeof candidate.customerState === "string") &&
    (candidate.customerPostalCode === null || typeof candidate.customerPostalCode === "string") &&
    (candidate.customerFullAddress === null || typeof candidate.customerFullAddress === "string")
  );
}

const AUTOMATION_ACTIONS: AutomationAction[] = [
  "getPageInfo",
  "highlightSelector",
  "clickSelector",
  "extractText",
  "setValue",
];

export function isAutomationAction(value: unknown): value is AutomationAction {
  return typeof value === "string" && AUTOMATION_ACTIONS.includes(value as AutomationAction);
}

export function isAutomationCommand(value: unknown): value is AutomationCommand {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as AutomationCommand;
  return (
    isAutomationAction(candidate.action) &&
    (candidate.selector === undefined || typeof candidate.selector === "string") &&
    (candidate.value === undefined || typeof candidate.value === "string")
  );
}

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ExtensionRequest>;

  if (candidate.type === "runAutomation") {
    return isAutomationCommand((candidate as RunAutomationRequest).command);
  }

  if (candidate.type === "getSettings") {
    return true;
  }

  if (candidate.type === "updateSettings") {
    return Boolean((candidate as UpdateSettingsRequest).settings);
  }

  if (candidate.type === "leadIndicatorDetected") {
    return isLeadIndicatorDetection(
      (candidate as LeadIndicatorDetectedRequest).detection,
    );
  }

  if (candidate.type === "adfDetected") {
    return (
      typeof (candidate as AdfDetectedRequest).sourceUrl === "string" &&
      typeof (candidate as AdfDetectedRequest).fingerprint === "string"
    );
  }

  if (candidate.type === "createTwentyLead") {
    return (
      typeof (candidate as CreateTwentyLeadRequest).sourceUrl === "string" &&
      Array.isArray((candidate as CreateTwentyLeadRequest).rawAdfs) &&
      (candidate as CreateTwentyLeadRequest).rawAdfs.every((item) => typeof item === "string") &&
      ((candidate as CreateTwentyLeadRequest).pageContext === undefined ||
        isLeadPageContext((candidate as CreateTwentyLeadRequest).pageContext))
    );
  }

  if (candidate.type === "createTwentyLeadBatch") {
    return (
      typeof (candidate as CreateTwentyLeadBatchRequest).sourceUrl === "string" &&
      Array.isArray((candidate as CreateTwentyLeadBatchRequest).items) &&
      (candidate as CreateTwentyLeadBatchRequest).items.every(isMatterHistoryImportItem) &&
      ((candidate as CreateTwentyLeadBatchRequest).customerSnapshot === undefined ||
        (candidate as CreateTwentyLeadBatchRequest).customerSnapshot === null ||
        isMatterCustomerSnapshot((candidate as CreateTwentyLeadBatchRequest).customerSnapshot))
    );
  }

  if (candidate.type === "testTwentyConnection") {
    return true;
  }

  return false;
}

export function successResult(
  action: AutomationAction,
  data: Record<string, unknown> = {},
): AutomationResult {
  return {
    ok: true,
    action,
    data,
  };
}

export function errorResult(
  action: AutomationAction,
  error: string,
): AutomationResult {
  return {
    ok: false,
    action,
    error,
  };
}
