import { deepFreezeOwnData } from "../authority/strict-json.ts";

/** Minimal public excerpt catalog for Account inspection only. No transport bodies or ingestion contract.
 * Batch 02 handoff SHA-256: 8416d8bdfae5da50a7fa3e8f611bf6e4f1c7e2f2e65f0df222a42f20df3c2f87.
 * Source URLs are external-and-nonbinding evidence; technical checks confer no content approval.
 */
export const ACCOUNT_RESEARCH_CATALOG = deepFreezeOwnData({
  "sources": [
    {
      "id": "missouri-it-about",
      "url": "https://doit.missouri.edu/about/",
      "acquiredAt": "2026-09-08T05:32:33.709393+00:00",
      "publicationDate": null,
      "evidenceCurrentThrough": null,
      "sourceUpdatedLabel": null,
      "humanApproved": false,
      "accountId": "acc_university_of_missouri",
      "label": "MU DoIT · About"
    },
    {
      "id": "missouri-it-services",
      "url": "https://doit.missouri.edu/services/",
      "acquiredAt": "2026-09-08T05:32:34.764274+00:00",
      "publicationDate": null,
      "evidenceCurrentThrough": null,
      "sourceUpdatedLabel": null,
      "humanApproved": false,
      "accountId": "acc_university_of_missouri",
      "label": "MU DoIT · IT services"
    },
    {
      "id": "missouri-it-leaders",
      "url": "https://doit.missouri.edu/about/it-leadership-team/",
      "acquiredAt": "2026-09-08T05:32:35.415353+00:00",
      "publicationDate": null,
      "evidenceCurrentThrough": null,
      "sourceUpdatedLabel": null,
      "humanApproved": false,
      "accountId": "acc_university_of_missouri",
      "label": "MU DoIT · IT leadership team"
    },
    {
      "id": "utah-it-leaders",
      "url": "https://it.utah.edu/cio/uit-leadership.php",
      "acquiredAt": "2026-09-08T05:32:36.070083+00:00",
      "publicationDate": null,
      "evidenceCurrentThrough": null,
      "sourceUpdatedLabel": "Last Updated: 6/30/26",
      "humanApproved": false,
      "accountId": "acc_university_of_utah",
      "label": "Utah UIT · UIT leadership"
    }
  ],
  "candidates": [
    {
      "id": "mu-it-operating-context",
      "accountId": "acc_university_of_missouri",
      "sourceId": "missouri-it-about",
      "topic": "organization",
      "exactExcerpt": "The Division of Information Technology (DoIT) oversees the university’s information technology operations and serves as a pivotal support hub for your department and project endeavors.",
      "sourceAttributedSummary": "MU DoIT describes university IT operations and departmental/project support.",
      "limitation": "Does not establish procurement authority, separate system-campus decision rights or an org-chart hierarchy.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    },
    {
      "id": "mu-it-service-breadth",
      "accountId": "acc_university_of_missouri",
      "sourceId": "missouri-it-services",
      "topic": "technology",
      "exactExcerpt": "The Division of IT offers a wide variety of technology services for MU community. We provide the applications, infrastructure, and support services that enable faculty to teach and conduct research, students to learn, and staff to manage the business operations of the university.",
      "sourceAttributedSummary": "MU DoIT describes applications, infrastructure and support across teaching, research, learning and administration.",
      "limitation": "Service remit is not a deployed product inventory, spend total or contract opportunity.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    },
    {
      "id": "mu-it-ai-evaluation",
      "accountId": "acc_university_of_missouri",
      "sourceId": "missouri-it-services",
      "topic": "technology",
      "exactExcerpt": "The Division of IT reviews current and new AI technologies to find opportunities to incorporate them into our technology architecture and learning environment.",
      "sourceAttributedSummary": "MU DoIT reports evaluating AI technologies for architecture and learning.",
      "limitation": "Evaluation does not establish a purchase, funded project, deployed agent or product fit.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    },
    {
      "id": "mu-it-canlas",
      "accountId": "acc_university_of_missouri",
      "sourceId": "missouri-it-leaders",
      "topic": "people",
      "exactExcerpt": "Benjamin Canlas\nVice President for IT and MU Chief Information Officer",
      "sourceAttributedSummary": "The MU IT leadership page lists Benjamin Canlas as Vice President for IT and MU Chief Information Officer.",
      "limitation": "Public role only; no buying-owner or campus/system authority inference.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    },
    {
      "id": "mu-it-fowler",
      "accountId": "acc_university_of_missouri",
      "sourceId": "missouri-it-leaders",
      "topic": "people",
      "exactExcerpt": "Rebecca Fowler\nChief Information Security Officer",
      "sourceAttributedSummary": "The MU IT leadership page lists Rebecca Fowler as Chief Information Security Officer.",
      "limitation": "Public role only; no relationship, buying authority or reporting-line inference.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    },
    {
      "id": "mu-it-keeler",
      "accountId": "acc_university_of_missouri",
      "sourceId": "missouri-it-leaders",
      "topic": "people",
      "exactExcerpt": "Matthew Keeler\nDirector of IT Research Support Solutions",
      "sourceAttributedSummary": "The MU IT leadership page lists Matthew Keeler as Director of IT Research Support Solutions.",
      "limitation": "Public role only; no relationship, buying authority or reporting-line inference.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    },
    {
      "id": "utah-it-johansen",
      "accountId": "acc_university_of_utah",
      "sourceId": "utah-it-leaders",
      "topic": "people",
      "exactExcerpt": "Jake Johansen\nChief Information Officer (interim)",
      "sourceAttributedSummary": "The Utah UIT leadership page lists Jake Johansen as interim Chief Information Officer.",
      "limitation": "Preserve interim qualifier. No appointment date, buying authority or known relationship is established.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    },
    {
      "id": "utah-it-long",
      "accountId": "acc_university_of_utah",
      "sourceId": "utah-it-leaders",
      "topic": "people",
      "exactExcerpt": "Trevor Long\nChief Information Security Officer (interim)",
      "sourceAttributedSummary": "The Utah UIT leadership page lists Trevor Long as interim Chief Information Security Officer.",
      "limitation": "Preserve interim qualifier. No appointment date, buying authority or known relationship is established.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    },
    {
      "id": "utah-it-livingston",
      "accountId": "acc_university_of_utah",
      "sourceId": "utah-it-leaders",
      "topic": "people",
      "exactExcerpt": "Jim Livingston\nChief Technology Officer",
      "sourceAttributedSummary": "The Utah UIT leadership page lists Jim Livingston as Chief Technology Officer.",
      "limitation": "Public role only; no relationship, buying authority or reporting-line inference.",
      "support": "direct source text, not independent corroboration",
      "reviewStatus": "unreviewed_research",
      "approved": false,
      "ratified": false,
      "includedInBriefProjection": false,
      "graphWrite": false
    }
  ],
  "boundaries": {
    "humanContentApproval": false,
    "graphAdmission": false,
    "durableProductWrite": false,
    "modelInputChanged": false,
    "historicalResponseChanged": false,
    "defaultRuntimeAcquisition": false
  }
} as const);
