# C2-01 — Fresh retained two-account execution result

Status: **validated outputs and regenerated local review surfaces complete; needs human review; mixed provider-execution heads; not merged or deployed**

Authorization slug: `c2-fresh-retained-two-account-20260829`

## Result

Both retained accounts now have schema-v2 proposals accepted by the current deterministic validator and rendered at head `2b8a2962976d03ebc5b96756f76b30aadd22ba5d`.

| Account | Sources | Provider calls for selected output | Input / output tokens | Review state |
| --- | ---: | ---: | ---: | --- |
| University of Utah | 10 | 1 | 4,216 / 1,253 | `needs_review` |
| FedEx Corporation | 9 | 1 | 4,081 / 1,260 | `needs_review` |

The durable provider-call authorization budget is closed at **4 / 4 consumed**. Three provider/model calls actually executed: one FedEx validated call, one Utah output rejected by deterministic validation, and one final Utah validated call. The first historical Utah operational reservation failed before provider import and executed no provider/model call. No correction call executed.

## Current sanitized artifacts

- `data/fresh/university-of-utah-validated-proposal.json`
- `data/fresh/university-of-utah-effect-receipt.json`
- `data/fresh/fedex-validated-proposal.json`
- `data/fresh/fedex-effect-receipt.json`
- `fresh-model-artifact-lineage.json`
- `fresh-university-of-utah.html`
- `fresh-fedex.html`
- `FRESH_VISUAL_REVIEW.md`
- `fresh-browser-interaction-proof.json`
- `screenshots/fresh/`

Private prompts, raw responses, complete private result bundles, request/session identifiers, credentials, and private paths remain outside the repository.

## Effect boundary

- Database writes: **0**
- Graph writes: **0**
- Persistence writes: **0**
- Deployments: **0**
- Publications: **0**
- Customer actions: **0**
- Tools offered to the provider: **0**
- Hidden retries: **0**

Provider storage, behavior, tool, and network effects remain externally variable/unestablished except for the local receipts recorded here.

## Exact-head limitation

This is **not** a single-head two-account provider-to-render proof. Utah's selected provider output executed and validated at `2b8a296`; FedEx's selected provider output executed at preceding reviewed head `b44471e` and was revalidated byte-for-byte at `2b8a296`. Prompt hashes did not change, but the lineage does not collapse those two execution heads into one.

## Decision

The regenerated pages passed local desktop/mobile and evidence-dialog review and are suitable for human review. They are not approved durable account truth. Merge remains separately gated by the final PR SHA, exact-head CI, independent review, and owner confirmation.
