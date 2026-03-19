import {
  detectAdfInText,
  mergeImportedLeads,
  normalizeLeadSource,
  parseAdfLead,
} from "../../src/shared/adf";

const SAMPLE_ADF = `
<html>
<body>Hello David<br />
Thank you for taking the time to contact <a href="https://www.rockcityhd.com/">Rock City Harley-Davidson</a>.<br />
If you would like to speak with us immediately, please contact our internet team directly @501-214-1776<br />
Internet Sales<br />Rock City Harley-Davidson<br />400 Gateway Grove Loop<br />Little Rock, AR 72210<br />501-214-9979<br />
<div id='EmailTrackingBlock' style='display:none'>---Please Do Not Delete
lTaskID=1490942334</div>
To stop receiving these messages visit <a href="https://api.eleadcrm.com/email/public/v1/optin/index?eqsv2=abc">Communication Preferences</a>
</body>
</html>
<!--ChildId:16935-->
`;

const SAMPLE_XML_ADF = `<?adf version="1.0"?>
<adf>
    <prospect>
        <id sequence="1" source="MotoMate123">69b0b744863abac139405c27</id>
        <requestdate>2026-03-11T00:28:48.542Z</requestdate>
        <customer>
            <contact>
                <name part="first">David</name>
                <name part="last">Money</name>
                <email>cavertn@gmail.com</email>
                <phone type="cellphone">2567149042</phone>
            </contact>
            <comments>Sent from VDP page</comments>
        </customer>
        <vendor>
            <vendorname>Rock City Harley-Davidson</vendorname>
            <url>Sent from VDP page</url>
        </vendor>
        <provider>
            <name part="full">MotoMate123</name>
            <service>Coupon Lead</service>
            <leadtype>Internet</leadtype>
        </provider>
    </prospect>
</adf>`;

const SAMPLE_XML_NO_PHONE_ADF = `<?adf version="1.0"?>
<adf>
    <prospect>
        <id sequence="1" source="MotoMate123">phone-missing</id>
        <requestdate>2026-03-11T00:28:48.542Z</requestdate>
        <customer>
            <contact>
                <name part="first">David</name>
                <name part="last">Money</name>
                <email>cavertn@gmail.com</email>
            </contact>
        </customer>
        <vendor>
            <vendorname>Rock City Harley-Davidson</vendorname>
        </vendor>
    </prospect>
</adf>`;

const SAMPLE_VIEW_EMAIL_RAW_BODY = `<!--Body
:<?xml version="1.0" encoding="UTF-8"?>
${SAMPLE_XML_ADF}
-->`;

const SAMPLE_MISSED_BARE_XML_ADF = `<adf>
  <prospect>
    <id sequence="1" source="LeadID">0d405f1b-1440-4d1c-979e-e56b1558f54c</id>
    <requestdate>2026-03-11T03:11:42.3770000Z</requestdate>
    <vehicle interest="buy" status="cpo">
      <model>Nightster</model>
      <year>2023</year>
      <make>Harley-Davidson</make>
    </vehicle>
    <customer>
      <contact>
        <name part="first">Matthew</name>
        <name part="last">Murphree</name>
        <email>matthewmurphree1@gmail.com</email>
        <phone type="voice" time="day">8702600364</phone>
        <address>
          <street line="1">412 N Center St</street>
          <city>Alpine</city>
          <regioncode>AR</regioncode>
          <postalcode>71921</postalcode>
        </address>
      </contact>
      <comments><![CDATA[Model Year: 2023, Model: Nightster, VIN: 1HD1ZH110PB311358, PreQual: N, PreQualified Amount; $0 Please note non-prequalified customers can still be considered for approval with a completed credit application. HDMC-Campaign-Tracking Code: HDFS PQ ]]></comments>
    </customer>
    <vendor>
      <vendorname>Rock City Harley-Davidson</vendorname>
    </vendor>
    <provider>
      <name part="full" type="individual">Harley-Davidson</name>
      <service>Marketplace - Prequal</service>
    </provider>
  </prospect>
</adf>`;

const SAMPLE_MISSED_XML_WITH_DECLARATION = `<?xml version="1.0" encoding="UTF-8"?>
${SAMPLE_MISSED_BARE_XML_ADF}`;

const SAMPLE_SPARSE_MATTHEW_ADF = `
<html>
<body>Hello Matthew<br />
Thank you for taking the time to contact <a href="https://www.rockcityhd.com/">Rock City Harley-Davidson</a>.<br />
If you would like to speak with us immediately, please contact our internet team directly @501-214-1776<br />
</body>
</html>
`;

describe("shared/adf", () => {
  it("detects ADF text blocks embedded in page text", () => {
    const detection = detectAdfInText(`before ${SAMPLE_ADF} middle ${SAMPLE_XML_ADF} after`);

    expect(detection.found).toBe(true);
    expect(detection.rawAdfs).toHaveLength(2);
    expect(detection.rawAdfs[0]).toContain("EmailTrackingBlock");
    expect(detection.fingerprint).toMatch(/^adf_/);
  });

  it("detects ADF text inside the View Email hidden raw-body wrapper", () => {
    const detection = detectAdfInText(SAMPLE_VIEW_EMAIL_RAW_BODY);

    expect(detection.found).toBe(true);
    expect(detection.rawAdfs).toHaveLength(1);
    expect(detection.rawAdfs[0]).toContain("<provider>");
  });

  it("detects bare and xml-declared adf documents", () => {
    const bareDetection = detectAdfInText(SAMPLE_MISSED_BARE_XML_ADF);
    const xmlDetection = detectAdfInText(SAMPLE_MISSED_XML_WITH_DECLARATION);

    expect(bareDetection.found).toBe(true);
    expect(bareDetection.rawAdfs).toHaveLength(1);
    expect(xmlDetection.found).toBe(true);
    expect(xmlDetection.rawAdfs).toHaveLength(1);
  });

  it("parses ADF text into normalized lead data", () => {
    const lead = parseAdfLead(SAMPLE_ADF, "https://dealer.example/lead/1490942334");

    expect(lead.customerName).toBe("David");
    expect(lead.dealerName).toBe("Rock City Harley-Davidson");
    expect(lead.primaryPhone).toBe("5012141776");
    expect(lead.primaryPhoneSource).toBe("html_generic");
    expect(lead.phoneNumbers).toContain("5012149979");
    expect(lead.dealershipWebsite).toBe("https://www.rockcityhd.com/");
    expect(lead.taskId).toBe("1490942334");
    expect(lead.childId).toBe("16935");
    expect(lead.optOutUrl).toContain("api.eleadcrm.com");
  });

  it("parses XML ADF text into normalized lead data", () => {
    const lead = parseAdfLead(SAMPLE_XML_ADF, "https://dealer.example/lead/facebook");

    expect(lead.customerName).toBe("David Money");
    expect(lead.customerFirstName).toBe("David");
    expect(lead.customerLastName).toBe("Money");
    expect(lead.customerEmail).toBe("cavertn@gmail.com");
    expect(lead.primaryPhone).toBe("2567149042");
    expect(lead.primaryPhoneSource).toBe("xml_customer_mobile");
    expect(lead.comments).toBe("Sent from VDP page");
    expect(lead.taskId).toBe("69b0b744863abac139405c27");
    expect(lead.sourceProvider).toBe("MotoMate123");
    expect(lead.providerLeadType).toBe("Internet");
  });

  it("parses the missed harley xml lead shape into richer lead data", () => {
    const lead = parseAdfLead(
      SAMPLE_MISSED_XML_WITH_DECLARATION,
      "https://dealer.example/lead/harley-prequal",
    );

    expect(lead.customerName).toBe("Matthew Murphree");
    expect(lead.customerEmail).toBe("matthewmurphree1@gmail.com");
    expect(lead.primaryPhone).toBe("8702600364");
    expect(lead.primaryPhoneSource).toBe("xml_customer_other");
    expect(lead.customerStreetAddress).toBe("412 N Center St");
    expect(lead.customerCity).toBe("Alpine");
    expect(lead.customerState).toBe("AR");
    expect(lead.customerPostalCode).toBe("71921");
    expect(lead.vehicleYear).toBe(2023);
    expect(lead.vehicleMake).toBe("Harley-Davidson");
    expect(lead.vehicleModel).toBe("Nightster");
    expect(lead.vehicleVin).toBe("1HD1ZH110PB311358");
    expect(lead.vehicleInterest).toBe("buy");
    expect(lead.vehicleStatus).toBe("cpo");
    expect(lead.prequalStatus).toBe("not_prequalified");
    expect(lead.isPrequalLead).toBe(true);
    expect(lead.prequalifiedAmount).toBe(0);
    expect(lead.campaignCode).toBe("HDFS PQ");
    expect(lead.vehicleSummary).toContain("Nightster");
    expect(lead.latestInquirySourceRaw).toBe("Harley-Davidson");
    expect(lead.latestInquirySubSourceRaw).toBe("Marketplace - Prequal");
    expect(lead.parsingWarnings).toHaveLength(0);
  });

  it("normalizes visible source values into analytics channels", () => {
    expect(normalizeLeadSource("MotoMate123", "Coupon Lead")).toBe("motomate");
    expect(normalizeLeadSource("Facebook Lead Form")).toBe("facebook");
    expect(normalizeLeadSource("Tik Tok Campaign")).toBe("tiktok");
    expect(normalizeLeadSource("Website", "VDP page")).toBe("website");
  });

  it("merges multiple ADF sources into one richer lead", () => {
    const lead = parseAdfLead(`${SAMPLE_ADF}\n${SAMPLE_XML_ADF}`, "https://dealer.example/lead/merged", {
      rawSource: "MotoMate123",
      rawSubSource: "Coupon Lead",
      rawUpType: "Internet Up",
      normalizedSource: "motomate",
    });

    expect(lead.rawAdfDocuments).toHaveLength(2);
    expect(lead.customerName).toBe("David Money");
    expect(lead.customerEmail).toBe("cavertn@gmail.com");
    expect(lead.primaryPhone).toBe("2567149042");
    expect(lead.primaryPhoneSource).toBe("xml_customer_mobile");
    expect(lead.phoneNumbers).toContain("5012141776");
    expect(lead.phoneNumbers).toContain("2567149042");
    expect(lead.dealerName).toBe("Rock City Harley-Davidson");
    expect(lead.rawAdfHtml).toContain("MotoMate123");
    expect(lead.rawAdfHtml).toContain("EmailTrackingBlock");
    expect(lead.latestInquirySourceRaw).toBe("MotoMate123");
    expect(lead.latestInquirySubSourceRaw).toBe("Coupon Lead");
    expect(lead.latestInquiryNormalizedSource).toBe("motomate");
    expect(lead.inquiryHistory).toHaveLength(2);
    expect(lead.inquiryHistory[0]?.sourceRaw).toBe("MotoMate123");
  });

  it("keeps xml customer phones ahead of html phones regardless of document order", () => {
    const htmlThenXml = parseAdfLead(`${SAMPLE_ADF}\n${SAMPLE_XML_ADF}`, "https://dealer.example/lead/order-1");
    const xmlThenHtml = parseAdfLead(`${SAMPLE_XML_ADF}\n${SAMPLE_ADF}`, "https://dealer.example/lead/order-2");

    expect(htmlThenXml.primaryPhone).toBe("2567149042");
    expect(xmlThenHtml.primaryPhone).toBe("2567149042");
    expect(htmlThenXml.primaryPhoneSource).toBe("xml_customer_mobile");
    expect(xmlThenHtml.primaryPhoneSource).toBe("xml_customer_mobile");
  });

  it("falls back to html phones when xml customer phones are missing", () => {
    const lead = parseAdfLead(
      `${SAMPLE_XML_NO_PHONE_ADF}\n${SAMPLE_ADF}`,
      "https://dealer.example/lead/html-fallback",
    );

    expect(lead.primaryPhone).toBe("5012141776");
    expect(lead.primaryPhoneSource).toBe("html_generic");
  });

  it("merges multiple imported pages while preserving matter timeline and artifact blocks", () => {
    const oldestLead = parseAdfLead(SAMPLE_XML_ADF, "https://dealer.example/lead/oldest", {
      rawSource: "Website",
      rawSubSource: "VDP page",
      rawUpType: "Internet Up",
      normalizedSource: "website",
    });
    const newestLead = parseAdfLead(SAMPLE_ADF, "https://dealer.example/lead/newest", {
      rawSource: "MotoMate123",
      rawSubSource: "Coupon Lead",
      rawUpType: "Internet Up",
      normalizedSource: "motomate",
    });

    const merged = mergeImportedLeads(
      [oldestLead, newestLead],
      "https://dealer.example/opportunity/1",
      [
        {
          eventId: "1",
          sourceUrl: "https://dealer.example/lead/oldest",
          title: "Older source",
          taskId: "1490942332",
          completedAt: "3/09/26 7:29 PM",
          activityType: "Internet Up",
          outcome: "Opened",
          comment: "Website inquiry",
          completedBy: "Agent, A",
          sourceRaw: "Website",
          subSourceRaw: "VDP page",
          hasAdf: true,
        },
        {
          eventId: "2",
          sourceUrl: "https://dealer.example/lead/newest",
          title: "Newest source",
          taskId: "1490942333",
          completedAt: "3/10/26 7:29 PM",
          activityType: "Internet Up",
          outcome: "Auto Response",
          comment: "MotoMate123 Coupon Lead",
          completedBy: "Agent, L",
          sourceRaw: "MotoMate123",
          subSourceRaw: "Coupon Lead",
          hasAdf: true,
        },
      ],
    );

    expect(merged.latestInquirySourceRaw).toBe("MotoMate123");
    expect(merged.primaryPhone).toBe("2567149042");
    expect(merged.primaryPhoneSource).toBe("xml_customer_mobile");
    expect(merged.matterTimeline).toHaveLength(2);
    expect(merged.adfArtifacts).toHaveLength(2);
    expect(merged.adfArtifacts[0]?.fileName).toContain(".adf.xml");
  });

  it("backfills surname, email, and address from the matter snapshot when the ADF is sparse", () => {
    const sparseLead = parseAdfLead(
      SAMPLE_SPARSE_MATTHEW_ADF,
      "https://dealer.example/lead/matthew",
      {
        rawSource: "Harley-Davidson",
        rawSubSource: "Marketplace - Prequal",
        rawUpType: "Internet Up",
        normalizedSource: "other",
      },
    );

    const merged = mergeImportedLeads(
      [sparseLead],
      "https://dealer.example/opportunity/2",
      [],
      {
        customerName: "Matthew Murphree",
        customerFirstName: "Matthew",
        customerLastName: "Murphree",
        customerEmail: "matthewmurphree1@gmail.com",
        customerPhone: "(256) 714-9042",
        customerStreetAddress: "400 Gateway Loop",
        customerCity: "Little Rock",
        customerState: "AR",
        customerPostalCode: "72210",
        customerFullAddress: "400 Gateway Loop, Little Rock, AR 72210",
      },
    );

    expect(merged.customerName).toBe("Matthew Murphree");
    expect(merged.customerLastName).toBe("Murphree");
    expect(merged.customerEmail).toBe("matthewmurphree1@gmail.com");
    expect(merged.primaryPhone).toBe("2567149042");
    expect(merged.primaryPhoneSource).toBe("matter_snapshot");
    expect(merged.customerStreetAddress).toBe("400 Gateway Loop");
    expect(merged.customerPostalCode).toBe("72210");
    expect(merged.vehicleYear).toBeNull();
  });

  it("prefers the newest high-confidence xml phone over an older html phone during imports", () => {
    const olderHtmlLead = parseAdfLead(SAMPLE_ADF, "https://dealer.example/lead/older-html");
    const newerXmlLead = parseAdfLead(SAMPLE_XML_ADF, "https://dealer.example/lead/newer-xml");

    const merged = mergeImportedLeads(
      [olderHtmlLead, newerXmlLead],
      "https://dealer.example/opportunity/3",
    );

    expect(merged.primaryPhone).toBe("2567149042");
    expect(merged.primaryPhoneSource).toBe("xml_customer_mobile");
    expect(merged.phoneNumbers).toEqual(expect.arrayContaining(["5012141776", "5012149979", "2567149042"]));
  });
});
