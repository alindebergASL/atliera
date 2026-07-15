# M5b FedEx System-Acquired Source Pre-Effect — Gate A Status

Status: active, in progress, unarmed pre-effect

This runbook records the implemented M5b Gate A candidate for the eventual page “FedEx — source-backed account snapshot.” It is substantive runtime code plus deterministic review artifacts, not a plan and not a shipped M5b loop. It authorizes and performs no private custody read, provider/model call, acquisition, graph ingestion, durable write, deployment, recurrence, identity work, or production effect.

Boundary markers after completion:

- implementation_work_authorized: none
- current_effective_authorization: none
- authorizes_private_custody_read: false
- authorizes_provider_call: false
- authorizes_acquisition: false
- authorizes_graph_ingestion: false
- authorizes_durable_write: false
- authorizes_deployment: false
- authorizes_retry: false
- private_reads: 0
- provider_calls: 0
- acquisitions: 0
- graph_writes: 0
- deployments: 0
- effects: 0
- retries: 0
- independently_verified_objects: 0
- readiness_claim: false
- shipped_claim: false

## Implemented narrow path

`src/workshop/m5b-fedex-system-acquired-source.ts` pins the exact M4 custody artifact SHA-256, decoded response size and SHA-256, M4 target-policy and capability-descriptor SHA-256 values, source URL, CIK, acquired timestamp, and original custody retention deadline. The future production admission wrapper accepts only caller-supplied bytes. It has no path parameter or default path and performs no file read. It checks the outer custody SHA-256 before UTF-8 decoding or parsing, snapshots parsed data through own enumerable data descriptors, validates the exact M4 custody/acquisition/execution envelope, reuses the unchanged `extractM4SecEvidence` validator, verifies body hash and size, and strictly decodes the response before exact comparison with the canonical production pins can select the internal production-admission token. Alternate synthetic pins always remain non-production.

The bounded extractor preserves exact literals for `/name`, `/cik`, `/tickers`, `/exchanges`, `/sic`, and `/sicDescription`. Production-admitted extraction is internal and token-gated; no exported options or boolean can self-assert it. The only public raw-response extractor is narrowly fixture-only and always emits `exactProductionCustodyAdmissionCompleted: false` with the exact synthetic/committed-public fixture notice. Sanitized pack construction accepts only bounded source objects issued by these internal extraction paths. The extractor records CIK display padding and aligned ticker/exchange selection as explicit transformations. Optional filing metadata is emitted only when all four `filings.recent` arrays are own-data arrays of equal length, every filing date is canonical, and the newest date is unique. Any mismatch, invalid date, duplicate newest date, or other ambiguity omits the filing row.

The sanitized source-pack schema is canonical-JSON hashed and includes serialized production-admission evidence in exactly one of two forms. The committed fixture has `productionAdmissionEvidence: null` together with its unchanged synthetic classification and `exactProductionCustodyAdmissionCompleted: false`. Only the internal exact byte-admission path may populate the evidence object, after validation, with the pinned custody artifact SHA-256, decoded response byte count, response SHA-256, target-policy SHA-256, capability-descriptor SHA-256, source URL, CIK, acquired timestamp, and `exact-production-custody-admission-completed` state. That evidence is covered by the source-pack hash. The pack contains no raw response, encoded response, private path, contact, resolved IP address, or credential. The review packet binds every claim to exact literals, JSON pointers, canonical source-pack spans, source URL, production response SHA-256, source-pack SHA-256, and every deterministic transformation. The two required proposals are individually pending and accept/reject capable. Promotion of the public SourceDocument beyond `2026-08-13T18:41:11.277Z` is a separate pending human retention decision.

Individual proposal decisions are pure and hash-bound. Partial decisions stay unarmed. Duplicate, missing-shape, unknown, counterfeit-packet, counterfeit-hash, and counterfeit-boundary inputs refuse. Proposal acceptance does not authorize the separate future private read, optional provider call, or durable write.

## Visible candidate

`src/workshop/m5b-fedex-prewrite-workshop.ts` builds a parsed and validated GraphBundle with one SourceDocument, two required unverified system-created claims, two Maps account objects, proposed excerpts, and zero independently verified objects. A clean uniquely newest filing row may add one metadata-only Signal and one claim; the candidate never exceeds four excerpts, three claims, or three account objects. “Air Courier Services” is visibly scoped to the SEC SIC label and is not presented as a comprehensive description of FedEx’s current business.

The renderer escapes all content. It emits a link only for credential-free HTTP(S) URLs and adds `rel="noreferrer noopener"`; unsafe URLs remain text. The committed demo deliberately uses empty filing arrays, so Signals and Plays both render honest empty states. Its fixture label explicitly states that the input is synthetic/committed-public and exact private source admission did not occur.

Visible artifact:

- `fixtures/workshop/m5b-fedex-system-acquired-prewrite-review.html`

Machine review artifacts:

- `fixtures/validation/m5b-fedex-system-acquired-demo-source-pack.json`
- `fixtures/validation/m5b-fedex-system-acquired-review-packet.json`

Committed generator input and command:

- `fixtures/validation/m5b-fedex-system-acquired-demo-source.json`
- `npm run workshop:m5b-fedex-prewrite`

The generator reads only that fixed committed input and writes only the source pack, review packet, and HTML paths above. It imports no network, provider, private-read, or durable-write module.

## Optional model and future effect seams

The optional model proposal contract is inert: model-only transport; the complete verified sanitized source pack as the exact input; an independently checked exact source-pack hash binding; existing excerpt IDs only; at most one future call; zero retries; provider and model unselected; tools, shell, files, web, MCP, retrieval, plugins and session carryover false; provider-call authority false; calls performed zero. Its validator rejects a missing, mismatched, rehashed-counterfeit, or non-canonical embedded pack. It permits at most one filing-metadata Signal or the restrained proposed Play “Review the cited filing before the next FedEx account conversation,” and rejects both-item output, invented excerpts, broader prose, and any non-unverified status.

The future composition is reserved for an exact production-custody-admitted pack and refuses unless canonical-hash verification succeeds over the serialized exact admission evidence, `exactProductionCustodyAdmissionCompleted: true`, classification `exact-production-custody-admitted`, a null fixture-input hash, and every pinned production source/custody-admission/response field. It has no WeakSet, object-identity, or same-process issuance prerequisite: an honestly admitted source pack can be serialized for human review and parsed in a later process before review decisions and composition. Rehashing synthetic content after only flipping its classification or admission flag cannot establish the required evidence. The committed synthetic demo therefore cannot compose a future durable effect, even after every proposal and the separate retention decision are accepted. A future positive composition remains plain frozen data over existing drafted-approval, exact-content-binding, one-shot-arming, shared-writer-lock, durable-write, read-back, and render boundary references. It carries the exact source-pack, review-packet, review-decision, and candidate-content hashes, accepted proposal IDs, at most one future durable write, one read-back, one render, and zero retries. It contains no DB path, writer callback, execution method, write-capable closure, armed state, or effect authority. The PR’s refusal helper always returns pre-effect with zero writes and zero other effects.

## Remaining blocker and next gate

Exact production admission is not complete because the private custody bytes were neither available nor authorized to be read in this Gate A slice. Consequently the real positive future-composition path remains blocked. A future private-read packet must supply the exact private custody path separately, and a separately authorized reader must pass its bytes to the pinned byte-only wrapper. That decision is distinct from any optional provider call, human proposal dispositions, retention promotion, durable write approval/arming, acquisition, or deployment decision. M5b remains 🔶 in progress and is not shipped.
