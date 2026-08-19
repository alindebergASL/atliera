# C1 Calm read-only Account Home — implementation review record

Status: **implementation candidate ready for exact-head review; not customer acceptance and not merge authority**

Date: 2026-08-19

## Identities and authority

- Repository base: `3766e4502103e20ae00d8a38f36ba213b470354e`
- Repository base tree: `4e9ec3b3c83b2e81ae7c8528276b70c6cc7dbad6`
- Branch: `feat/c1-calm-read-only-account-home-02`
- C1 authority: `EXPLICIT_OWNER_AUTHORIZATION_C1_CALM_READ_ONLY_ACCOUNT_HOME_02`
- Responsive evidence correction authority: `EXPLICIT_OWNER_AUTHORIZATION_C1_RESPONSIVE_EVIDENCE_CORRECTION_01`
- Packet ID: `atliera-evidence-horizon-system-v3.1`
- Packet status: `owner_approved_calibration_amendment`
- Packet archive SHA-256: `a95ffa97d054b24d80251bd796f4922a35ee342866a338b764037d8c449a06a4`
- Packet archive bytes: `22,373,486`
- Packet manifest SHA-256: `2c173165c2ce68d24e28b0a082e91bc999f5abe5f52632be3251fdfc745756a8`
- Packet `SHA256SUMS` SHA-256: `ec1e761acce66285909f5c6759bd9e28c7d985f4600b8646f354168d319ebd33`
- Repository import: `../visual-calibration/atliera-evidence-horizon-system-v3.1/`
- Transport ZIP committed: **no**
- Imported file checks and PNG full decoding: **pass**

Canonical repository product, trust, security, and milestone documents govern. The packet is visual calibration, not runtime input, account truth, fixture truth, a pixel-copy requirement, or authority beyond C1.

## Implementation architecture

C1 is implemented as a local/test-only projection with no HTTP route:

- `src/workshop/calm-account-home.ts`
  - authenticates the exact package artifact set against the in-memory trusted prepare-result capability through `admitM5bProductReviewPackageArtifactsAgainstTrustedPrepareResult(...)`;
  - projects only the resulting admitted `sourcePack`, `reviewPacket`, and featured material-change chain;
  - renders one standalone deterministic HTML artifact;
  - never reads a raw request as product truth;
  - returns a fixed, data-free blocked proof when the attempt wrapper receives unadmitted/tampered or insufficient input;
  - performs no provider, network, source acquisition, private, database, Graph, persistence, route, deployment, or outbound effect.
- `src/workshop/calm-account-home-style.ts`
  - holds exact v3.1 token families plus responsive, focus, dialog, reduced-motion, and reflow rules;
  - holds the fixed dialog controller whose exact SHA-256 is pinned in the generated CSP.
- `tests/fixtures/c1-calm-account-home.ts`
  - creates repository-safe no-plan and admitted-plan variants from the existing synthetic M5b fixture;
  - runs the existing prepare/admission boundary in-process.
- `scripts/generate-c1-calm-account-home.mts`
  - provides the explicit local/test generation seam;
  - writes only the stable checked golden fixture.
- `fixtures/workshop/c1-calm-account-home.html`
  - is the stable no-plan golden artifact.
- `fixtures/workshop/c1-calm-account-home-plan.html`
  - is the stable admitted-plan golden artifact used for responsive evidence-reachability proof.

No source under `src/runtime/` is imported or changed. The existing `/workshop` fake runtime and M5b Package Inspector remain untouched.

## C1 requirement map

| Requirement | Implementation | Verification evidence |
| --- | --- | --- |
| Admitted input only | trusted prepare-result capability admission before projection | `rejects unadmitted or tampered input before rendering` test |
| Deterministic output | pure projection/render over frozen admitted state | byte-identical and golden-sync tests |
| One account thesis | hero narrative | density/order test; all screenshots |
| One meaningful change | exact material-change excerpt | density/order and evidence tests |
| One implication | admitted Map title, labeled draft interpretation | density/order and inference-boundary tests |
| One next move | admitted Play title, labeled draft recommendation | density/order and inference-boundary tests |
| One compact trust cue | draft/origin/review/freshness line | trust test and screenshots |
| Established → Open → Next | evidence spine and horizon orientation | density test and screenshots |
| Evidence within two interactions | one-click native modal for each consequential statement; the `What changed` evidence trigger remains visible at tablet/mobile widths in plan and no-plan states | evidence and responsive browser-interaction proof |
| No more than three secondary items | one closed native `Explore account` disclosure | exact-count test and browser proof |
| No-plan action | `View evidence` opens change evidence | plan/no-plan test and golden |
| Plan action | `View existing meeting plan` reveals only admitted plan | plan/no-plan test |
| No C2/C3/C4/C7/C9 leakage | forbidden literal and static boundary checks | milestone-leakage tests |
| No Package Inspector exposure | no link, embed, route, import, or build reference | focused inspector-separation test |
| Hostile input safety | contextual escaping, strict admission, unsafe-URL refusal | hostile content/URL tests |
| No client network/navigation | no anchors; canonical HTTPS values render as inert text; hashed CSP; zero client-network boundary | structure/security tests and browser resource inspection |
| Accessible interaction | native dialog, explicit close control, Escape and Close focus return, 44px targets | tests and browser interaction proof |
| Responsive/reflow | 1440, 1280, 768, 390 plus 640/320 CSS-pixel checks | measured DOM evidence and screenshots |
| Safe failure | invalid/unadmitted input is rejected before rendering; attempt wrapper emits fixed data-free blocked proof | admission and blocked-proof tests |
| Existing M5b behavior unchanged | isolated new module and no M5b/runtime modification | full existing test suite gate and diff review |

## Default-visible density

The default view contains exactly:

1. account identity and page purpose;
2. one thesis;
3. one meaningful change;
4. one implication;
5. one proposed next move;
6. one compact trust/freshness line;
7. one truthful primary action.

Three ranked secondary items remain closed behind `Explore account`. Evidence excerpts, source metadata, support boundaries, and plan details remain inside deliberate dialogs. No default-visible lens panels, equal-weight card grids, scores, source lists, metadata tables, lifecycle matrices, or audit mechanics are present.

## Trust derivation

- Fixture/request-authored prose is never called AI-generated.
- Package attribution alone is never called Source-backed.
- `Source-backed` is derived only when authenticated/admitted source custody and accepted exact support are both true.
- `Reviewed` is derived only when a recorded human review proof is true.
- The checked C1 fixture renders `Draft · Attributed synthetic sources · Not reviewed · Freshness not established`.
- Source date is `Not separately established`; retrieval context is presented separately.
- Recommendation and interpretation dialogs state what admitted facts support and what the sources do not directly establish.
- Approval, durability, snapshot, delivery, and publication are not implied.

## Browser and responsive proof

Measured with the checked golden HTML in a real Chromium browser:

| Viewport | `clientWidth` | `scrollWidth` | Primary top/bottom | Fully visible | Result |
| --- | ---: | ---: | ---: | --- | --- |
| 1440×1100 | 1425 | 1425 | 759 / 807 | yes | pass |
| 1280×900 | 1265 | 1265 | 759 / 807 | yes | pass |
| 768×900 | 753 | 753 | 839 / 887 | yes | pass |
| 390×844 | 375 | 375 | 788 / 836 | yes | pass |
| 640 CSS px (200% equivalent) | 625 | 625 | present | n/a | no overflow |
| 320 CSS px (400% reflow equivalent) | 305 | 305 | present | n/a | no overflow |

Additional browser proof:

- evidence dialog opens modally;
- close control receives focus;
- native Escape closes the dialog;
- focus returns to the invoking control;
- `Explore account` starts closed and exposes exactly three items;
- no external resource/client-network requests are initiated;
- no active anchor/navigation exists;
- hashed CSP executes the exact style and controller without `unsafe-inline`.

Responsive evidence correction proof is recorded in `c1-responsive-evidence-browser-proof.json`. At both 768×900 and 390×844, for both admitted-plan and no-plan variants:

- the statement-local `evidence-change` control is visible with a 44px target;
- its reserved heading width prevents trigger/heading overlap;
- it opens `#evidence-change` and exposes the exact excerpt plus support/non-support boundaries;
- Escape and the visible Close button both close the dialog and return focus to the invoking evidence control;
- the no-plan primary action still opens `evidence-change`;
- the admitted-plan primary action remains `View existing meeting plan`, opens `#existing-meeting-plan`, and exposes all three admitted questions;
- the primary action remains fully visible;
- document `scrollWidth` equals `clientWidth`.

Measured contrast ratios:

- main ink on canvas: 14.49:1;
- secondary ink on canvas: 5.78:1;
- evidence green on canvas: 5.62:1;
- action blue on canvas: 5.31:1;
- white on action blue: 5.90:1;
- dark-plane eyebrow: 10.15:1;
- dark-plane status: 10.38:1;
- dark-plane copy: 14.08:1;
- dark-plane evidence link: 9.91:1.

## Golden and screenshot identities

- Golden HTML: `../../fixtures/workshop/c1-calm-account-home.html`
  - SHA-256: `d36322e8e6f4f9415dcf6de80b1f1391cf07b024ac2fbc31951aa20902c2c697`
- Admitted-plan golden HTML: `../../fixtures/workshop/c1-calm-account-home-plan.html`
  - SHA-256: `ee53e47ab74aa444be6850a6139abbffd446fcc129e645a9f713c01900ab80c1`
- Desktop 1440×1100: `c1-account-home-desktop-1440.png`
  - SHA-256: `5baa3e4a188a4496f680654a7ec2738c04d78d60303ad07e9ec80b2da50133ee`
- Laptop 1280×900: `c1-account-home-laptop-1280.png`
  - SHA-256: `c3c4855a83a9bfd8410720ccdd6aad37385e81b2627d76a1ef6a482292a52e2c`
- Tablet 768×900: `c1-account-home-tablet-768.png`
  - SHA-256: `d5faac145d59e9940d48632646001d709cb5dae3ba6d76440642615b2b5c682b`
- Mobile 390×844: `c1-account-home-mobile-390.png`
  - SHA-256: `14d174a92cd404b05d84a5413a99d94c8f6585393daed083057b8db078ec276b`
- Admitted-plan tablet 768×900: `c1-account-home-plan-tablet-768.png`
  - SHA-256: `fdcf54e1e25d4e715b26c461fd0c9a77d5ef19c61d0566ac6b6b6440a608121a`
- Admitted-plan mobile 390×844: `c1-account-home-plan-mobile-390.png`
  - SHA-256: `4666ad04fcc2220222b8f140a66be9a2c699303c1260779b51eb8e380511c233`
- Responsive browser proof: `c1-responsive-evidence-browser-proof.json`
  - SHA-256: `065131e786fb1d3992ad7dc8bbc86449164d7f1906ca017ec9a419fefabef45b`

## Product/UX scorecard

Independent corrected-render pre-commit review: **PASS**.

| Category | Weight | Score (0–4) |
| --- | ---: | ---: |
| Craft | 15 | 3.5 |
| Cognitive load | 20 | 3.7 |
| Information scent | 10 | 3.6 |
| AI presence / honest absence | 15 | 3.9 |
| Trust calmness | 15 | 3.8 |
| Responsive system | 10 | 3.8 |
| Accessibility | 10 | 3.4 |
| Originality | 5 | 3.7 |
| **Weighted total** | **100** | **92.1** |

Threshold result:

- weighted score ≥85: pass;
- no category below 3.0: pass;
- Craft ≥3.5: pass;
- Cognitive Load ≥3.5: pass;
- AI Presence / honest absence ≥3.5: pass;
- Trust Calmness ≥3.5: pass.

Expressive-lineage assessment:

- **Editorial Intelligence:** preserved through asymmetric editorial composition, oversized account identity, authored thesis, connected account story, and one composed next-move plane.
- **Change Horizon:** transformed into a source-fact → open-interpretation → next-move evidence spine with explicit Established → Open → Next orientation.
- **Question Stage:** preserved through familiar headings (`What changed`, `Why it may matter`, `Recommended next move`) and outcome-predictive evidence labels rather than ontology or chat.
- **Evidence Horizon:** preserved through adjacent statement-level evidence, support/non-support boundaries, exact excerpts, and one connected reading path.

The render does not copy predecessor branding, false dynamic claims, shell controls, monitoring, AI activity, reviewed/current state, or future preparation behavior.

## Review history and remaining confirmation

The first pre-commit review returned HOLD at 83.6/100 for narrow-screen priority inversion, subdued dark-plane status, incomplete browser proof, and safe-failure ambiguity. Corrections made:

- compressed admitted implication/next-move copy;
- moved and compacted the next-move/trust/action plane;
- made the primary action fully visible at every required screenshot viewport;
- raised dark-plane status contrast to 10.38:1;
- completed required overflow, reflow, dialog, Escape, and focus-return measurements;
- replaced `unsafe-inline` CSP with exact SHA-256 style/script authorization;
- removed active external navigation and made canonical HTTPS references inert;
- added a fixed data-free blocked proof while preserving pre-render rejection for invalid/unadmitted input.

After exact-head review, the owner found one merge-blocking responsive evidence-reachability defect: the first statement-local trigger was hidden at widths ≤900px, making `What changed` evidence unreachable when the admitted meeting plan owned the primary action. The authorized correction:

- keeps that trigger visible and statement-associated at tablet/mobile widths;
- uses the existing full label at tablet and compact `Evidence` label at mobile;
- reserves heading width so the control does not overlap narrative hierarchy;
- leaves `View existing meeting plan` unchanged in the admitted-plan state;
- records real-browser plan/no-plan evidence, Escape, Close, focus-return, primary-action, and overflow proof.

Correction verification before commit:

- focused C1, packet, and review-bundle tests: 14/14 PASS;
- full local `npm run ci`: PASS;
- `git diff --check`: PASS;
- fresh exact-head Product/UX, Architecture/Trust, and Accessibility/Security reviews are required after the correction commit.

Independent Architecture/Trust pre-commit review: **PASS**.

Pre-commit full `npm run ci` after the final code, golden, screenshots, review record, and review-bundle test: **PASS**.

Final exact-head Product/UX, Architecture/Trust, and Accessibility/Security confirmations remain required after the implementation commit. This record does not claim representative-user, expert-blind content-quality, zero-training, customer-readiness, merge, or deployment acceptance.

## Effect accounting

- provider/model calls: 0;
- network/source acquisition: 0;
- private source reads: 0;
- database reads/writes: 0;
- Graph reads/writes: 0;
- identity/authorization changes: 0;
- customer/runtime routes: 0;
- deployments: 0;
- persistence/ratification/approval/snapshot: 0;
- publication/share/send/outbound actions: 0;
- monitoring/recurrence/delta detection: 0;
- C2+ behavior: 0.

This C1 authority is local/test-only. The implementation remains unmerged and undeployed.
