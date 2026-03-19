import {
  DEFAULT_SETTINGS,
  mergeSettings,
  sanitizeSettings,
} from "../../src/shared/settings";
import { getRequiredFieldError, isAutomatableUrl } from "../../src/background/helpers";

describe("shared/settings", () => {
  it("merges partial settings with defaults", () => {
    expect(
      mergeSettings({
        defaultSelector: "#root",
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      defaultSelector: "#root",
    });
  });

  it("sanitizes out-of-range values", () => {
    expect(
      sanitizeSettings({
        highlightDurationMs: 100000,
      }),
    ).toEqual({
      highlightDurationMs: 10000,
    });
  });

  it("sanitizes Twenty CRM settings", () => {
    expect(
      sanitizeSettings({
        enableLeadSound: false,
        enableLeadNotifications: false,
        twentyBaseUrl: " https://api.twenty.com/ ",
        twentyApiKey: " test-key ",
        twentyLeadEndpointPath: " rest/leads ",
      }),
    ).toEqual({
      enableLeadSound: false,
      enableLeadNotifications: false,
      twentyBaseUrl: "https://api.twenty.com/",
      twentyApiKey: "test-key",
      twentyLeadEndpointPath: "rest/leads",
    });
  });
});

describe("background/helpers", () => {
  it("rejects Firefox internal URLs", () => {
    expect(isAutomatableUrl("about:addons")).toBe(false);
    expect(isAutomatableUrl("moz-extension://abc/options.html")).toBe(false);
    expect(isAutomatableUrl("https://example.com")).toBe(true);
  });

  it("returns action-specific validation errors", () => {
    expect(getRequiredFieldError("getPageInfo")).toBeNull();
    expect(getRequiredFieldError("highlightSelector", "")).toBe("This action requires a CSS selector.");
    expect(getRequiredFieldError("setValue", "#email", "")).toBe("Set value requires text to insert.");
  });
});
