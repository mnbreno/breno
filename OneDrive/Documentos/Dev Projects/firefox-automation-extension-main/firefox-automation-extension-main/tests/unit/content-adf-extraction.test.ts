import {
  detectAdfInRawBodyHtml,
  parseLeadSourceSummary,
  unwrapHiddenRawBody,
} from "../../src/content/adf-extraction";

const SAMPLE_HIDDEN_RAW_BODY = `<!--Body
:<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?><adf>
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
        </vendor>
        <provider>
            <name part="full">MotoMate123</name>
            <service>Coupon Lead</service>
            <leadtype>Internet</leadtype>
        </provider>
    </prospect>
</adf>
-->`;

describe("content/adf-extraction", () => {
  it("unwraps hidden raw-body content from the View Email page", () => {
    const unwrapped = unwrapHiddenRawBody(SAMPLE_HIDDEN_RAW_BODY);

    expect(unwrapped).toContain("<?adf version=\"1.0\"?>");
    expect(unwrapped).not.toContain("<!--Body");
    expect(unwrapped).not.toContain("-->");
  });

  it("detects ADF in hidden raw-body html", () => {
    const detection = detectAdfInRawBodyHtml(SAMPLE_HIDDEN_RAW_BODY);

    expect(detection.found).toBe(true);
    expect(detection.rawAdfs).toHaveLength(1);
    expect(detection.rawAdfs[0]).toContain("<prospect>");
  });

  it("parses visible lead-source summaries from the email body", () => {
    expect(parseLeadSourceSummary("MotoMate123 - Coupon Lead")).toEqual({
      rawSource: "MotoMate123",
      rawSubSource: "Coupon Lead",
    });

    expect(parseLeadSourceSummary("Facebook")).toEqual({
      rawSource: "Facebook",
      rawSubSource: null,
    });
  });
});
