import {
  errorResult,
  isAutomationCommand,
  isExtensionRequest,
  successResult,
} from "../../src/shared/messages";

describe("shared/messages", () => {
  it("accepts valid automation commands", () => {
    expect(
      isAutomationCommand({
        action: "highlightSelector",
        selector: "#app",
      }),
    ).toBe(true);
  });

  it("rejects invalid automation actions", () => {
    expect(
      isAutomationCommand({
        action: "deleteTheInternet",
      }),
    ).toBe(false);
  });

  it("accepts supported extension requests", () => {
    expect(
      isExtensionRequest({
        type: "runAutomation",
        command: {
          action: "getPageInfo",
        },
      }),
    ).toBe(true);

    expect(
      isExtensionRequest({
        type: "createTwentyLead",
        sourceUrl: "https://dealer.example/lead/1",
        rawAdfs: ["<html><body>Hello David</body></html>"],
        pageContext: {
          rawSource: "MotoMate123",
          rawSubSource: "Coupon Lead",
          rawUpType: "Internet Up",
          normalizedSource: "motomate",
        },
      }),
    ).toBe(true);

    expect(
      isExtensionRequest({
        type: "createTwentyLeadBatch",
        sourceUrl: "https://dealer.example/opportunity/1",
        customerSnapshot: {
          customerName: "Matthew Murphree",
          customerFirstName: "Matthew",
          customerLastName: "Murphree",
          customerEmail: "matthewmurphree1@gmail.com",
          customerPhone: "2567149042",
          customerStreetAddress: "400 Gateway Loop",
          customerCity: "Little Rock",
          customerState: "AR",
          customerPostalCode: "72210",
          customerFullAddress: "400 Gateway Loop, Little Rock, AR 72210",
        },
        items: [
          {
            sourceUrl: "https://dealer.example/lead/1",
            title: "MotoMate123 Coupon Lead",
            taskId: "1490942333",
            completedAt: "3/10/26 7:29 PM",
            activityType: "Internet Up",
            outcome: "Auto Response",
            comment: "Sent from VDP page",
            completedBy: "Agent, L",
            pageContext: {
              rawSource: "MotoMate123",
              rawSubSource: "Coupon Lead",
              rawUpType: "Internet Up",
              normalizedSource: "motomate",
            },
            rawAdfs: ["<?adf version=\"1.0\"?><adf></adf>"],
          },
        ],
      }),
    ).toBe(true);
  });

  it("builds success and error responses", () => {
    expect(successResult("getPageInfo", { title: "Example" })).toEqual({
      ok: true,
      action: "getPageInfo",
      data: { title: "Example" },
    });

    expect(errorResult("clickSelector", "Missing selector")).toEqual({
      ok: false,
      action: "clickSelector",
      error: "Missing selector",
    });
  });
});
