# M5b schema-v1 real package assessment

Status: product gate failed; execution provenance on hold; no ratification or apply is eligible.

This review records the outcome of an external, nonbinding sanitized package supplied for review. The package itself and its private source custody are not committed to the repository. This document authorizes no source read, acquisition, ratification, apply, graph/database write, provider call, deployment, retry, or cleanup.

## Reviewed identity

- archive: `atliera-m5b-fedex-sanitized-review-cf682913.tar.gz`
- archive SHA-256: `b53b87c263364ce9353f8f1f804fefdc24d441dce53aca37ece1b3d33ba7e9bf`
- canonical prepare result: `cf682913fc6de8540cfab203df39c3882b6889ae80aa095bac99c4cc490a2e04`
- canonical source pack: `c4bfafda0db60aa042d8b07cd8eeb11f70c1f3bf10be474fee6ed50f36393f40`
- canonical candidate: `1bebf5c7240023e230eca5236ffb7f89333e4c3302e9bb51c4831adaec810263`
- canonical review packet: `e9b383c2ced1f79bdd66f7dbfb2d377082164b7162cb10f61e1efa339ddfef03`
- claimed execution commit/tree: `3b9326810840ac87980bbc247ab39f03ebc3cd94` / `e1fb37633913a138f4bf54efb5daf9446289352f`
- package state: unratified, unarmed, apply-ineligible, and non-durable

### Exact six-file ledger

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `sanitized-source-pack.json` | 7,569 | `137782a2e5546ccbb1be8cc1e74fb513cf56840f35f025b167b864a462be4a6d` |
| `candidate.json` | 18,512 | `73c0fa38102c6ce408b2de1c64188607466d26b67fdedfbba2b008393f34de0a` |
| `review-packet.json` | 13,449 | `cf051cb0e7bc365151295ea97018a3f6b6247ace2491de3cacd12b11e1cb55bf` |
| `workshop-pre-ratification.html` | 25,357 | `f05fdaf5e743e3c0151d540fd71e9f16abd5447e8bbe5a0b0161a08c6cdfaa9d` |
| `meeting-brief.md` | 4,839 | `0a65bfe27b16d58dd3bab1a8907eda8c8a7a55fef3701f4d2667d893ed26e515` |
| `prepare-result.json` | 2,663 | `b34ec2f507079e606e16d53b8ce4e04dd722f7e90ebddfc0ef9a8f370508fb22` |

The six files total 72,389 bytes. The five entries embedded in `prepare-result.json` match these raw hashes and sizes, and the result's canonical hash matches the identity above.

## Gate result

| Dimension | Result | Finding |
| --- | --- | --- |
| Six-file byte ledger | Pass | The exact inventory, raw hashes, byte sizes, package hash chain, candidate hydration, evidence offsets, proposal dependencies, and graph references reconcile. |
| Product usefulness | Fail | The 107,366-byte primary 8-K contributes only `FEDEX CORPORATION`; the other retained excerpt is `Air Courier Services`. Neither describes the disclosed event, its consequence, an account-specific risk, or a useful meeting hypothesis. |
| Renderer reproducibility at claimed commit/tree | Fail | The meeting brief re-renders exactly, but the Workshop was post-processed after prepare to add prerequisite-effect text. Its final bytes are self-consistently rehashed but are not the bytes produced by the renderer at the claimed commit/tree. |
| Exact execution provenance | Hold | The request, original custody, source-effect ledgers, archive packet, and referenced execution receipt are outside the six-file package. The reported reviewed/current archive-packet hash mismatch therefore cannot be resolved from the package. |

The unavailable archive packet was authorized/reviewed at `014532ecb0148d56482ca51b0507caa321b04c50b4ba0eb595fc86db750444be` but later reported on disk at `0042bb2aa7513285dce86d323360183a86568ab0aa5a35875859f2a83e9932f0`. Neither byte sequence is present in the sanitized package.

## Historical effect accounting

The package's prepare result records one retained-custody read. Hermes separately reported one archive acquisition/network request from the prior successful prepare-only run. Those are reported or package-recorded historical effects, not erased by the failed product gate, but the missing execution inputs and archive mismatch leave their exact provenance on hold. Hermes's later stopped turn performed zero new source effects. Current future source-effect authorization remains zero; no ratification, graph/database write, apply, provider call, or deployment occurred.

The five-question product result is not good enough to ratify:

- “What meaningfully changed?” reports that an 8-K exists, not what happened.
- “Why does it matter?” says only that the filing could anchor a discussion.
- “What needs attention?” describes trust/process boundaries rather than account-specific unknowns or risks.
- The proposed Signal is issuer identity, the Map is an industry label, and the Play repeats the instruction to draft the brief already being reviewed.
- All analysis and recommendation claims ultimately depend on 37 characters of identity/classification evidence.

## Decision and successor gate

Do not ratify, apply, or use this package as a durable successor baseline. Preserve its bytes as historical review input only.

The immediate implementation successor is the schema-v2 generic prepare contract: every exact excerpt carries an evidence role, and at least one explicitly typed `material_change` excerpt must bind the “What changed?” answer and flow through a source-fact Signal, a dependent Map analysis, and every Play. The role makes the producer assertion explicit but does not prove business materiality, so a human usefulness review remains mandatory. Generated package files remain immutable; prerequisite effects belong in a separate exact execution receipt.

Only after that implementation is merged may a separately authorized fresh real prepare be considered. That future run must use exact reviewed inputs and return a useful v2 package before any generic ratification/apply bridge is built or exercised.
