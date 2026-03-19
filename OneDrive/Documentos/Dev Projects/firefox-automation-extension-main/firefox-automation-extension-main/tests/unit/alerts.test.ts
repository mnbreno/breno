import {
  buildAdfAlertSignature,
  buildLeadAlertSignature,
  shouldDispatchAlert,
} from "../../src/background/alerts";

describe("background/alerts", () => {
  it("builds dedupe signatures for lead badge alerts", () => {
    expect(
      buildLeadAlertSignature({
        url: "https://dealer.example/dashboard",
        title: "Dashboard",
        count: 2,
        text: "New Leads (2)",
        seenAt: "2026-03-10T00:00:00.000Z",
      }),
    ).toBe("https://dealer.example|2");
  });

  it("builds dedupe signatures for ADF detections", () => {
    expect(
      buildAdfAlertSignature("https://dealer.example/lead/1", "adf_123"),
    ).toBe("https://dealer.example/lead/1|adf_123");
  });

  it("suppresses repeated alerts with the same signature", () => {
    expect(shouldDispatchAlert(null, "sig_1")).toBe(true);
    expect(shouldDispatchAlert("sig_1", "sig_1")).toBe(false);
    expect(shouldDispatchAlert("sig_1", "sig_2")).toBe(true);
  });
});
