import {
  buildTwentyAuthorizationHeader,
  buildTwentyLeadPayload,
  buildUpdatePayload,
  extractRecordId,
} from "../../src/background/twenty";
import { parseAdfLead } from "../../src/shared/adf";
import type { ParsedAdfLead } from "../../src/shared/lead";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";

const SAMPLE_LEAD: ParsedAdfLead = {
  fingerprint: "adf_abc123",
  sourceUrl: "https://dealer.example/lead/1",
  source: "adf",
  sourceProvider: "MotoMate123",
  pageContext: {
    rawSource: "MotoMate123",
    rawSubSource: "Coupon Lead",
    rawUpType: "Internet Up",
    normalizedSource: "motomate",
  },
  rawAdfHtml: "<html>Hello David</html>",
  rawAdfDocuments: ["<html>Hello David</html>", "<?adf version=\"1.0\"?><adf></adf>"],
  plainText: "Hello David",
  customerName: "David Money",
  customerFirstName: "David",
  customerLastName: "Money",
  customerEmail: "cavertn@gmail.com",
  customerStreetAddress: "400 Gateway Loop",
  customerCity: "Little Rock",
  customerState: "AR",
  customerPostalCode: "72210",
  customerFullAddress: "400 Gateway Loop, Little Rock, AR 72210",
  dealerName: "Rock City Harley-Davidson",
  dealershipWebsite: "https://www.rockcityhd.com/",
  phoneNumbers: ["501-214-1776"],
  primaryPhone: "501-214-1776",
  primaryPhoneSource: "html_generic",
  vehicleYear: 2023,
  vehicleMake: "Harley-Davidson",
  vehicleModel: "Nightster",
  vehicleTrim: null,
  vehicleVin: "1HD1ZH110PB311358",
  vehicleInterest: "buy",
  vehicleStatus: "cpo",
  providerLeadType: "Internet",
  isPrequalLead: true,
  prequalStatus: "not_prequalified",
  prequalifiedAmount: 0,
  campaignCode: "HDFS PQ",
  vehicleSummary: "2023 Harley-Davidson Nightster (VIN: 1HD1ZH110PB311358)",
  comments: "Sent from VDP page",
  requestDate: "2026-03-11T00:28:48.542Z",
  optOutUrl: "https://api.eleadcrm.com/email/public/v1/optin/index?eqsv2=abc",
  taskId: "1490942334",
  childId: "16935",
  latestInquirySourceRaw: "MotoMate123",
  latestInquirySubSourceRaw: "Coupon Lead",
  latestInquiryUpType: "Internet Up",
  latestInquiryNormalizedSource: "motomate",
  inquiryHistory: [
    {
      eventId: "adf_abc123_1",
      sourceRaw: "MotoMate123",
      subSourceRaw: "Coupon Lead",
      upType: "Internet Up",
      normalizedSource: "motomate",
      provider: "MotoMate123",
      sourceUrl: "https://dealer.example/lead/1",
      requestDate: "2026-03-11T00:28:48.542Z",
      importedAt: "2026-03-10T00:00:00.000Z",
      rawAdfFingerprint: "adf_abc123",
      rawAdfDocument: "<html>Hello David</html>",
      taskId: "1490942334",
      childId: "16935",
    },
  ],
  matterTimeline: [
    {
      eventId: "matter_1",
      sourceUrl: "https://dealer.example/lead/1",
      title: "MotoMate123 Coupon Lead",
      taskId: "1490942334",
      completedAt: "3/10/26 7:29 PM",
      activityType: "Internet Up",
      outcome: "Auto Response",
      comment: "Sent from VDP page",
      completedBy: "Agent, L",
      sourceRaw: "MotoMate123",
      subSourceRaw: "Coupon Lead",
      hasAdf: true,
    },
  ],
  adfArtifacts: [
    {
      fileName: "2026-03-10_task_1490942334_MotoMate123.adf.xml",
      contentType: "text/xml",
      content: "<?adf version=\"1.0\"?><adf></adf>",
      sourceUrl: "https://dealer.example/lead/1",
      taskId: "1490942334",
      completedAt: "3/10/26 7:29 PM",
    },
  ],
  matterCustomerSnapshot: {
    customerName: "David Money",
    customerFirstName: "David",
    customerLastName: "Money",
    customerEmail: "cavertn@gmail.com",
    customerPhone: "501-214-1776",
    customerStreetAddress: "400 Gateway Loop",
    customerCity: "Little Rock",
    customerState: "AR",
    customerPostalCode: "72210",
    customerFullAddress: "400 Gateway Loop, Little Rock, AR 72210",
  },
  automotiveFieldSources: {
    vehicleYear: "xml",
    vehicleMake: "xml",
    vehicleModel: "xml",
    vehicleTrim: null,
    vehicleVin: "comment",
    vehicleInterest: "xml",
    vehicleStatus: "xml",
    providerLeadType: "xml",
    isPrequalLead: "comment",
    prequalStatus: "comment",
    prequalifiedAmount: "comment",
    campaignCode: "comment",
    vehicleSummary: "merged",
  },
  parsingWarnings: [],
  extractedAt: "2026-03-10T00:00:00.000Z",
};

const SAMPLE_HTML_WITH_DEALER_PHONE = `
<html>
<body>Hello David<br />
Thank you for taking the time to contact <a href="https://www.rockcityhd.com/">Rock City Harley-Davidson</a>.<br />
If you would like to speak with us immediately, please contact our internet team directly @501-214-1776<br />
</body>
</html>
`;

const SAMPLE_XML_WITH_CUSTOMER_PHONE = `<?adf version="1.0"?>
<adf>
  <prospect>
    <id sequence="1" source="MotoMate123">mixed-phone</id>
    <requestdate>2026-03-11T00:28:48.542Z</requestdate>
    <customer>
      <contact>
        <name part="first">David</name>
        <name part="last">Money</name>
        <email>cavertn@gmail.com</email>
        <phone type="cellphone">2567149042</phone>
      </contact>
    </customer>
    <vendor>
      <vendorname>Rock City Harley-Davidson</vendorname>
    </vendor>
  </prospect>
</adf>`;

describe("background/twenty", () => {
  it("extractRecordId handles common Twenty REST create response shapes", () => {
    expect(extractRecordId({ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })).toBe(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    );
    expect(
      extractRecordId({
        data: { inboundLead: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" } },
      }),
    ).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(
      extractRecordId({
        data: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      }),
    ).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(
      extractRecordId({
        data: [{ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }],
      }),
    ).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(
      extractRecordId({
        record: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      }),
    ).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
  });

  it("buildTwentyAuthorizationHeader avoids Bearer Bearer when key already includes Bearer", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.payload.sig";
    expect(buildTwentyAuthorizationHeader(token)).toBe(`Bearer ${token}`);
    expect(buildTwentyAuthorizationHeader(`Bearer ${token}`)).toBe(`Bearer ${token}`);
    expect(buildTwentyAuthorizationHeader(`bearer ${token}`)).toBe(`Bearer ${token}`);
    expect(buildTwentyAuthorizationHeader(`  Bearer   ${token}  `)).toBe(`Bearer ${token}`);
  });

  it("builds a templated payload from parsed lead data", () => {
    const payload = buildTwentyLeadPayload(SAMPLE_LEAD, DEFAULT_SETTINGS);

    expect(payload).toMatchObject({
      name: "David Money",
      vendorName: "Rock City Harley-Davidson",
      customerFirstName: "David",
      customerLastName: "Money",
      customerEmail: "cavertn@gmail.com",
      customerPhone: "501-214-1776",
      vehicleYear: 2023,
      vehicleMake: "Harley-Davidson",
      vehicleModel: "Nightster",
      vehicleVin: "1HD1ZH110PB311358",
      vehicleStatus: "cpo",
      providerLeadType: "Internet",
      prequalifiedAmount: 0,
      campaignCode: "HDFS PQ",
      latestInquirySubSourceRaw: "Coupon Lead",
      latestInquiryUpType: "Internet Up",
      latestProvider: "MotoMate123",
      status: "NEW",
      payloadRaw: {
        markdown: expect.stringContaining("FIREFOX_AUTOMATION_ANALYTICS_START"),
        blocknote: null,
      },
    });

    expect((payload.payloadRaw as { markdown: string }).markdown).toContain("\"latestInquirySourceRaw\": \"MotoMate123\"");
    expect((payload.payloadRaw as { markdown: string }).markdown).toContain("\"latestInquirySubSourceRaw\": \"Coupon Lead\"");
    expect((payload.payloadRaw as { markdown: string }).markdown).toContain("2026-03-10_task_1490942334_MotoMate123.adf.xml");
    expect((payload.payloadRaw as { markdown: string }).markdown).toContain("\"customerPostalCode\": \"72210\"");
    expect((payload.payloadRaw as { markdown: string }).markdown).toContain("\"vehicleVin\": \"1HD1ZH110PB311358\"");
  });

  it("updates existing leads with richer ADF details such as email", () => {
    const payload = buildUpdatePayload(
      {
        id: "lead_123",
        name: "David Money",
        customerFirstName: "David",
        customerLastName: "Money",
        customerEmail: "",
        customerPhone: "2567149042",
        vendorName: "Rock City Harley-Davidson",
        payloadRaw: {
          markdown: "",
          blocknote: null,
        },
      },
      SAMPLE_LEAD,
      DEFAULT_SETTINGS,
    );

    expect(payload).toMatchObject({
      customerEmail: "cavertn@gmail.com",
      customerPhone: "501-214-1776",
      vendorName: "Rock City Harley-Davidson",
      vehicleYear: 2023,
      vehicleMake: "Harley-Davidson",
      vehicleModel: "Nightster",
      vehicleVin: "1HD1ZH110PB311358",
      vehicleStatus: "cpo",
      providerLeadType: "Internet",
      prequalifiedAmount: 0,
      campaignCode: "HDFS PQ",
      latestInquirySubSourceRaw: "Coupon Lead",
      latestInquiryUpType: "Internet Up",
      latestProvider: "MotoMate123",
    });
  });

  it("supports typed number and boolean field-map values", () => {
    const payload = buildTwentyLeadPayload(SAMPLE_LEAD, {
      ...DEFAULT_SETTINGS,
      twentyLeadFieldMap: JSON.stringify({
        name: "{{customerName}}",
        vehicleYear: {
          value: "{{vehicleYear}}",
          type: "number",
        },
        isPrequalLead: {
          value: "{{isPrequalLead}}",
          type: "boolean",
        },
        prequalifiedAmount: {
          value: "{{prequalifiedAmount}}",
          type: "number",
        },
      }),
    });

    expect(payload).toMatchObject({
      name: "David Money",
      vehicleYear: 2023,
      isPrequalLead: true,
      prequalifiedAmount: 0,
    });
  });

  it("maps the selected high-confidence primary phone into Twenty payloads", () => {
    const lead = parseAdfLead(
      `${SAMPLE_HTML_WITH_DEALER_PHONE}\n${SAMPLE_XML_WITH_CUSTOMER_PHONE}`,
      "https://dealer.example/lead/phone-confidence",
    );

    const payload = buildTwentyLeadPayload(lead, DEFAULT_SETTINGS);

    expect(lead.primaryPhone).toBe("2567149042");
    expect(lead.primaryPhoneSource).toBe("xml_customer_mobile");
    expect(payload).toMatchObject({
      customerPhone: "2567149042",
    });
  });

  it("rejects unknown placeholders in the field map", () => {
    expect(() =>
      buildTwentyLeadPayload(SAMPLE_LEAD, {
        ...DEFAULT_SETTINGS,
        twentyLeadFieldMap: JSON.stringify({
          name: "{{customerName}}",
          mysteryField: "{{notARealPlaceholder}}",
        }),
      }),
    ).toThrow("Unknown Twenty field map placeholders");
  });
});
