/**
 * @jest-environment jsdom
 */

import {
  enrichMatterHistoryItemFromDetailHtml,
  extractMatterCustomerSnapshot,
  extractMatterHistoryItems,
} from "../../src/content/matter-sync";

const HISTORY_HTML = `
<table id="gvScheduled">
  <tr class="gridHeaderBgColor"><th>Due</th></tr>
  <tr class="even">
    <td>3/11/26 6:28 PM</td>
    <td>Phone Call</td>
    <td>Agent, L</td>
    <td>Follow up tomorrow</td>
  </tr>
</table>
<table id="gvOpptyHistory">
  <tr class="odd">
    <td><i id="img_1490942334" onclick="getTaskDetails('../elead_mail/viewemailmessage.aspx?p=BETUEAAA&amp;internal=1','1490942334');"></i></td>
    <td class="activityHeader">3/10/26 7:28 PM</td>
    <td class="activityHeader">Auto Response</td>
    <td class="activityHeader">Phone Follow Up</td>
    <td class="TaskComments">Rock City Harley-Davidson</td>
    <td class="completedBy">Agent, L</td>
    <td class="action"><a title="Opened" onclick="PopHistory('../elead_mail/viewemailmessage.aspx?p=BETUEAAA&amp;internal=1'); return false;"></a></td>
  </tr>
  <tr class="even">
    <td><i id="img_1490942333" onclick="getTaskDetails('../elead_mail/viewemailmessage.aspx?p=BMTUEAAA&amp;internal=1','1490942333');"></i></td>
    <td class="activityHeader">3/10/26 7:29 PM</td>
    <td class="activityHeader">Internet Up</td>
    <td class="activityHeader">Auto Response</td>
    <td class="TaskComments">MotoMate123 Coupon Lead: Money, David</td>
    <td class="completedBy">Agent, L</td>
    <td class="action"><a title="Opened" onclick="PopHistory('../elead_mail/viewemailmessage.aspx?p=BMTUEAAA&amp;internal=1'); return false;"></a></td>
  </tr>
</table>
`;

const DETAIL_HTML = `
<html>
  <head><title>View Email</title></head>
  <body>
    <table id="InsertionPointForBody">
      <tr><td>Lead Source:</td><td>MotoMate123 - Coupon Lead</td></tr>
    </table>
    <div id="InsertionPointForRawBody"><!--Body :<?adf version="1.0"?><adf><prospect><customer><contact><email>cavertn@gmail.com</email></contact></customer></prospect></adf>--></div>
  </body>
</html>
`;

const DETAIL_HTML_WITH_VISIBLE_XML = `
<html>
  <head><title>Harley ADF XML Lead</title></head>
  <body>
    <table id="InsertionPointForBody">
      <tr><td>Lead Source:</td><td>Harley-Davidson - Marketplace - Prequal</td></tr>
      <tr>
        <td colspan="2">
          Subject: Harley ADF XML Lead (MessageID: 614696939)
          <adf>
            <prospect>
              <id sequence="1" source="LeadID">0d405f1b-1440-4d1c-979e-e56b1558f54c</id>
              <requestdate>2026-03-11T03:11:42.3770000Z</requestdate>
              <customer>
                <contact>
                  <name part="first">Matthew</name>
                  <name part="last">Murphree</name>
                  <email>matthewmurphree1@gmail.com</email>
                </contact>
              </customer>
              <provider>
                <name part="full" type="individual">Harley-Davidson</name>
                <service>Marketplace - Prequal</service>
              </provider>
            </prospect>
          </adf>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const MATTER_CUSTOMER_HTML = `
<table>
  <tr>
    <td align="right"><a id="CustomerInfoPanel_NameLink">Name:</a></td>
    <td>Matthew Murphree</td>
    <td rowspan="5">
      <img
        id="CustomerInfoPanel_googlemaps"
        onclick="$.popup('https://maps.google.com/maps?saddr=,   ,  &amp;daddr=400 Gateway Loop,  LITTLE ROCK , AR 72210', '_blank', 855, 685, true, true, true);"
      />
    </td>
  </tr>
  <tr>
    <td align="right"><a id="CustomerInfoPanel_AddressLink">Address:</a></td>
    <td></td>
  </tr>
  <tr id="CustomerInfoPanel_CityStateZipRow">
    <td></td>
    <td class="headingBlack_11px"></td>
  </tr>
  <tr>
    <td align="right"><a id="CustomerInfoPanel_CPhoneLink">Cell #:</a></td>
    <td>(256) 714-9042</td>
  </tr>
  <tr>
    <td align="right">
      <a
        id="CustomerInfoPanel_PrefEmailLink"
        title="matthewmurphree1@gmail.com"
      >Preferred Email:</a>
    </td>
    <td>matthewmurphree1@gmail.co</td>
  </tr>
</table>
`;

describe("content/matter-sync", () => {
  it("extracts visible history rows oldest-to-newest", () => {
    const doc = new DOMParser().parseFromString(HISTORY_HTML, "text/html");
    const items = extractMatterHistoryItems(doc, "https://dealer.example/history.aspx");

    expect(items).toHaveLength(3);
    expect(items[0]?.completedAt).toBe("3/10/26 7:28 PM");
    expect(items[1]?.completedAt).toBe("3/10/26 7:29 PM");
    expect(items[2]?.title).toBe("Scheduled Activity");
  });

  it("enriches fetched detail pages with ADF and page context", () => {
    const enriched = enrichMatterHistoryItemFromDetailHtml(
      {
        sourceUrl: "https://dealer.example/elead_mail/viewemailmessage.aspx?p=BMTUEAAA&internal=1",
        title: "MotoMate123 Coupon Lead",
        taskId: "1490942333",
        completedAt: "3/10/26 7:29 PM",
        activityType: "Internet Up",
        outcome: "Auto Response",
        comment: "MotoMate123 Coupon Lead: Money, David",
        completedBy: "Agent, L",
        pageContext: null,
        rawAdfs: [],
      },
      DETAIL_HTML,
    );

    expect(enriched.rawAdfs).toHaveLength(1);
    expect(enriched.pageContext?.rawSource).toBe("MotoMate123");
    expect(enriched.pageContext?.rawSubSource).toBe("Coupon Lead");
  });

  it("falls back to visible body scanning when raw-body is absent", () => {
    const enriched = enrichMatterHistoryItemFromDetailHtml(
      {
        sourceUrl: "https://dealer.example/elead_mail/viewemailmessage.aspx?p=NITUEAAA&internal=1",
        title: "Harley ADF XML Lead",
        taskId: "1490955029",
        completedAt: "3/10/26 10:12 PM",
        activityType: "Internet Up",
        outcome: null,
        comment: "Internet Up",
        completedBy: "Agent, L",
        pageContext: null,
        rawAdfs: [],
      },
      DETAIL_HTML_WITH_VISIBLE_XML,
    );

    expect(enriched.rawAdfs).toHaveLength(1);
    expect(enriched.rawAdfs[0]).toContain("<adf>");
    expect(enriched.pageContext?.rawSource).toBe("Harley-Davidson");
    expect(enriched.pageContext?.rawSubSource).toBe("Marketplace - Prequal");
  });

  it("extracts matter customer snapshot with title-email and map-address fallbacks", () => {
    const doc = new DOMParser().parseFromString(MATTER_CUSTOMER_HTML, "text/html");
    const snapshot = extractMatterCustomerSnapshot(doc);

    expect(snapshot).toMatchObject({
      customerName: "Matthew Murphree",
      customerFirstName: "Matthew",
      customerLastName: "Murphree",
      customerEmail: "matthewmurphree1@gmail.com",
      customerPhone: "(256) 714-9042",
      customerStreetAddress: "400 Gateway Loop",
      customerCity: "LITTLE ROCK",
      customerState: "AR",
      customerPostalCode: "72210",
    });
  });
});
