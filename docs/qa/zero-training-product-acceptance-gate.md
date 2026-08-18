# Zero-training product acceptance gate

Status: **Owner-directed; proposed in-repository first-time-user acceptance authority pending merge.**

Parent product decision: [`../strategy/calm-product-hard-pivot.md`](../strategy/calm-product-hard-pivot.md)

Experience contract: [`../strategy/calm-everyday-experience-contract.md`](../strategy/calm-everyday-experience-contract.md)

Passing deterministic validation, rendering without errors, or looking attractive is not proof that Atliera is usable. Representative first-time-user evidence is required before broad customer UX implementation is accepted.

## Stage applicability

The complete gate applies before Atliera calls the ordinary multi-step customer journey accepted. Earlier bounded slices may test only scenarios they truthfully implement, but they remain **HOLD for broad customer acceptance**:

- the projection-only Account Home slice must run the first-readout, meaningful-change, evidence, `Prepare for…` discoverability, trust-origin, raw-audit-exposure, and dead-control checks;
- it must not be failed for lacking a preparation-generation workflow that its authority explicitly excludes, but it also must not claim the complete gate passed;
- the full 5–8-user round, including preparation completion, exception review, output approval, and monitoring/delta, is required once those stages exist and before broad customer UX acceptance.

## Gate population

Use **5–8 competent representative users** for each material ordinary-experience acceptance round.

The initial round recruits only the initial persona: B2B account leads or sellers who personally prepare for executive customer conversations. Every participant must have relevant account-preparation experience; record experience level and include a reasonable mix of company/account complexity. Do not combine executives, customer-success leaders, strategists, or domain specialists into that pass rate. If a materially different role becomes a target, run a separate 5–8-user round with its own job and thresholds.

Participants must not have prior Atliera product training. Record role, relevant account-preparation experience, and accessibility needs without collecting unnecessary personal data.

Do not give participants:

- a product walkthrough;
- a glossary;
- an architecture explanation;
- a description of Graph, packages, Signals/Maps/Plays, validation, or authorization;
- coaching during the measured journey;
- a prebuilt list of where to click.

A facilitator may restate the business goal but may not explain the product's internal model or point at controls.

## Hard quantitative thresholds

The round passes only when all thresholds hold:

1. At least **80%** of participants complete the core journey without coaching.
2. At least 80% understand the account, why now, and the recommended next move within **60 seconds** of the Account Workspace becoming usable.
3. At least 80% find `Prepare for…` within **15 seconds**.
4. The preparation journey requires no more than **two required inputs**: audience and desired outcome.
5. At least 80% reach important evidence within **two interactions**.
6. At least 80% correctly distinguish source-backed information from AI interpretation, request-supplied context, or other proposed content.
7. No participant is accidentally exposed to raw audit machinery during the core journey.
8. No participant misunderstands draft versus reviewed, approved, shared, or published state in a way that could cause a consequential mistake.
9. No dead or misleading control appears in the tested core journey.
10. The group median reports workload at or below the accepted baseline and confidence at or above the accepted baseline defined before the round.

A safety, trust, or dead-control failure is a hard HOLD even if the percentage averages would otherwise pass. Do not average away a participant's consequential misunderstanding.

## Expert-blind content-quality companion gate

Usability cannot compensate for a wrong or commercially weak answer. The same test account/output must receive a separate blind review from at least two qualified account/domain reviewers who did not author the content and are not shown whether a passage was produced by AI, a fixture, or a person.

Score each dimension from 1 (unacceptable) to 5 (strong):

1. material factual accuracy;
2. completeness of the account thesis and `why now`, including critical omissions;
3. evidence sufficiency and match between evidence and claim;
4. calibration of uncertainty, freshness, and conflict;
5. appropriateness, usefulness, and commercial safety of the recommended next move;
6. audience fit and meeting usefulness.

The companion gate passes only when the median score is at least 4 in every dimension, no reviewer scores any dimension below 3, and no hard failure occurs. Hard failures include an unsupported central thesis, a missed material contradiction or stale-status caveat, invented stakeholder/initiative/opportunity content, or a recommendation that could create a consequential commercial mistake.

Record reviewer disagreements and the approved answer/evidence key used to judge material accuracy. Both the zero-training usability gate and this content-quality gate must pass; confidence, visual polish, or task completion cannot substitute for answer quality.

## Core journey

Give the participant this business goal without product instructions:

> Understand this account, decide why it matters now, and prepare for a specific conversation.

Start timing when the Account Workspace becomes usable. The participant should:

1. state who the account is;
2. explain why it matters now;
3. identify the most meaningful change;
4. identify the people, initiatives, or opportunities that matter;
5. state the recommended next move and why;
6. inspect evidence for one important statement;
7. begin `Prepare for…`;
8. provide the audience and desired outcome;
9. review the prepared output and identify anything that still needs judgment;
10. state whether the output is draft, reviewed, approved, shared, or published.

Stop the core-journey timer when the participant can explain the account, next move, trust posture, and preparation outcome without help.

## Golden-journey scenarios

### 1. Account creation or selection

Test:

- entering an organization name or domain;
- optionally stating an objective;
- recognizing whether the account already exists;
- understanding what Atliera will do next without configuration.

Pass conditions:

- no ontology, report-builder, source-selection, or admin setup is required;
- defaults are understandable;
- research/synthesis is not implied before it begins;
- duplicate-account handling is clear.

### 2. First account readout

Test whether the participant can answer within 60 seconds:

- Who is this account?
- Why now?
- What changed?
- Who and what matter?
- What should I do next?

Pass conditions:

- the participant describes account meaning rather than reciting UI labels;
- the recommended move is evident;
- source coverage/freshness is understandable without opening audit detail;
- empty or irrelevant modules do not distract.

### 3. Meaningful-change discovery

Test:

- locating the most meaningful change;
- understanding its status and date;
- explaining why it matters;
- recognizing stale, conflicting, or incomplete evidence.

Pass conditions:

- the participant does not confuse a filing/source existence event with the business event;
- status and freshness are not conflated;
- important uncertainty is visible without legalistic repetition.

### 4. Evidence inspection

Ask the participant to prove one important statement.

Pass conditions:

- exact evidence is reached within two interactions;
- the statement, exact excerpt or values, source, date, and trust status are understandable;
- account context and return position are preserved;
- no internal ID search, package report, or binding knowledge is required;
- source-backed information is distinguished from interpretation.

### 5. Targeted meeting preparation

Give a 15-minute conversation goal.

Pass conditions:

- `Prepare for…` is found within 15 seconds;
- only audience and desired outcome are required;
- date, scope, evidence cutoff, and output format have sensible editable defaults;
- the output contains an executive thesis, first move, decision landscape, relevant stakeholders, opportunities/guardrails, open questions, meeting plan, and evidence access where relevant;
- the participant feels ready without reading a product report or Package Inspector;
- the participant can find ordered questions, desired learning, follow-up signals, and an overall close criterion.

Record time-to-ready and the three largest confusion moments.

### 6. Exception resolution

Use a scenario containing one material conflict, stale item, or consequential unsupported inference.

Pass conditions:

- the participant understands why judgment is needed;
- only affected material is presented;
- alternatives and evidence are understandable;
- the control's real effect is clear;
- no decision is presented as ratification or persistence unless it is.

### 7. Output approval

Use a proposed audience-specific briefing.

Pass conditions:

- draft, reviewed, approved, shared, and published states are distinct;
- the participant knows exactly what approval will freeze or authorize;
- publication or outbound action requires explicit authorization;
- the approved output is reproducible from one named snapshot without exposing raw machinery by default.

### 8. Monitoring and delta

Use a reviewed prior snapshot and later evidence.

Pass conditions:

- the participant sees what changed since the prior snapshot;
- the effect on the account thesis and next move is clear;
- old outputs remain historical and reproducible;
- the user understands that future output may change without believing history was rewritten;
- only consequential exceptions require judgment.

## State coverage

Every acceptance round must include or explicitly schedule coverage for:

- loading;
- partial data;
- empty account;
- stale evidence;
- conflicting evidence;
- recoverable error;
- non-recoverable dependency error;
- missing optional module;
- narrow/mobile layout.

For each state, test usefulness, plain language, honest trust, preservation of work, next action, and absence of internal machinery.

## Accessibility and responsive acceptance

The ordinary experience must meet a WCAG 2.2 AA baseline and the existing Atliera responsive gates. Verify at minimum:

- keyboard-only completion of the core journey, with logical order, visible focus, no trap, and correct focus return after evidence disclosure;
- screen-reader landmarks, headings, control names, state announcements, reading order, and evidence relationships;
- text and non-text contrast at AA thresholds;
- 200% zoom and 400% reflow without loss of content or function;
- touch targets at least 44 by 44 CSS pixels for ordinary interactive controls;
- desktop `1440×1100`, tablet `1024×900`, and mobile `390×844`;
- `document.documentElement.scrollWidth == document.documentElement.clientWidth` at each required viewport;
- no clipping, overlap, off-screen primary action, inaccessible disclosure, or meaning conveyed by color alone.

Run automated accessibility checks where available, but do not treat them as a substitute for keyboard and screen-reader testing. Any blocker that prevents an affected representative user from completing the journey is a hard HOLD.

## Measures

Record per participant:

- time to first accurate account explanation;
- time to identify why now;
- time to identify the recommended next move;
- time to find `Prepare for…`;
- required preparation-input count;
- evidence interaction count;
- core-journey completion time;
- coached versus uncoached completion;
- factual/support versus interpretation distinction accuracy;
- draft/reviewed/approved/shared/published distinction accuracy;
- number and severity of dead or misleading controls;
- raw-audit exposure incidents;
- workload rating on a defined 1–7 scale;
- confidence rating on a defined 1–7 scale;
- top three confusion moments with timestamp, goal, expectation, and impact;
- largest observed problem.

Define the acceptable workload and confidence baselines before testing. Do not choose thresholds after seeing results.

## Evidence record

The acceptance record should contain:

- tested commit and tree;
- environment and viewport;
- participant profile summary;
- task script;
- timings and interaction counts;
- observed errors and confusion moments;
- screenshots or recordings only with appropriate consent;
- exact pass/HOLD calculation;
- trust/safety hard failures;
- the single largest observed problem;
- the bounded next-slice recommendation.

Do not retain credentials, customer-sensitive source material, raw private evidence, or unnecessary participant personal data.

## Decision rule

- **PASS**: every hard quantitative threshold, the expert-blind content-quality companion gate, the accessibility/responsive baseline, and every trust/safety condition pass.
- **HOLD**: any threshold or companion gate fails, any accessibility blocker prevents completion, any dead/misleading control appears, any consequential state misunderstanding occurs, or raw audit machinery intrudes on the core journey.
- **INCONCLUSIVE**: the fixture/content is too sparse, the tested build differs from the recorded identity, or the sample/procedure is invalid. Inconclusive is not pass.

The next coding slice after a test round addresses only the largest observed problem unless a security, corruption, or trust-truth blocker requires immediate priority.

Visual attractiveness, stakeholder enthusiasm, a polished screenshot, or facilitator explanation is never sufficient evidence of usability.

## Pre-implementation requirement

The first implementation slice may use deterministic repository-safe data for engineering verification, but broad customer UX implementation is not accepted until representative first-time-user testing satisfies this gate. Structural wireframes or unpopulated concepts may validate layout; they cannot be reported as customer-value acceptance.

## Non-authorization

This gate does not authorize user recruitment, customer-data access, recording, implementation, provider calls, research, deployment, publication, or any other operational effect.
