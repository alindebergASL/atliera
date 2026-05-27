# Lab EC2 bootstrap validation runbook

This runbook records the clean-host EC2 bootstrap validation pattern for Atliera. It is intentionally lab-only and no-spend by default: it validates repository bootstrap, CI, and deterministic full-pipeline packaging from sanitized provider-validation evidence without making a live provider call, using network during packaging, or reading credentials during packaging.

## Current milestone

EC2 bootstrap validation completed on an operator-approved lab EC2 host using a DNS name rather than a raw IP command string. The host was treated as disposable lab infrastructure, not as production.

Validated state:

- source checkout: fresh clone of `main` at commit `f862bbf`;
- bootstrap command: `npm ci` passed;
- verification command: `npm run ci` passed;
- local test result observed on the clean host: 402 tests across 63 suites;
- package input: sanitized OpenRouter `owl-alpha` provider-validation report for `graph.propose`;
- package mode: deterministic no-spend full-pipeline packaging;
- safety flags: no live provider call, no network, and no credential read;
- deterministic manifest hash: `cc9b26b50b12031368a9399fcdd9d949af90f8dd8e21c2b8628a9a9ff4b3eaab`;
- determinism check: the local package hash, first clean-host package hash, and clean-host rerun hash matched exactly.

This milestone proves substrate portability and repeatability for the current package path. It does not imply production readiness, launch readiness, product-quality readiness, multi-account corpus readiness, or permission to deploy.

## Inputs to keep outside the repository

Keep private validation evidence outside the repository. The repository should receive only sanitized status summaries and repeatable procedures.

Use these placeholders in operator notes and shell examples:

- `<lab-dns-name>`: operator-approved lab host DNS name;
- `<checkout-root>`: clean clone directory on the lab host;
- `<private-evidence-root>`: private evidence root outside the repository;
- `<provider-report>`: sanitized provider-validation report filename;
- `<package-root>`: output directory for deterministic full-pipeline packages.

Do not commit:

- credential material;
- private provider request or response bodies;
- raw prompt text;
- absolute workstation or lab-host private evidence paths;
- raw IP addresses for lab hosts;
- operator approval internals beyond sanitized approval status.

## Repeatable procedure

### 1. Verify lab host and tooling

Use the operator-approved DNS name. Avoid raw IP command strings because local execution supervisors may classify them as raw-IP URL evidence and require a manual approval channel that is not available in every interface.

```bash
ssh <lab-dns-name> 'hostname && whoami'
ssh <lab-dns-name> 'git --version && node --version && npm --version'
```

### 2. Fresh clone

Clone the repository into a run-scoped directory and verify that the checkout matches the intended commit.

```bash
git clone <repo-url> <checkout-root>
cd <checkout-root>
git checkout main
git rev-parse --short HEAD
```

Expected milestone commit for this record:

```text
f862bbf
```

### 3. Install and run CI

```bash
cd <checkout-root>
npm ci
npm run ci
```

Expected result for the recorded milestone:

```text
402 tests
63 suites
0 failures
```

### 4. Stage sanitized provider evidence outside the repo

Copy only the sanitized provider-validation report into the private evidence root. The packaging step must consume that report through an explicit path and must not reread credentials or make a live provider call.

```bash
mkdir -p <private-evidence-root>/<package-root>
# Operator copies the sanitized provider report to:
# <private-evidence-root>/<provider-report>
```

### 5. Run deterministic full-pipeline packaging

Use an explicit timestamp from after the provider ledger timestamp and keep the output root outside the repository.

```bash
cd <checkout-root>
npm run --silent validation:full-pipeline -- \
  fixtures/graph/valid/minimal-pass.json \
  --provider-report <private-evidence-root>/<provider-report> \
  --out-root <private-evidence-root>/<package-root> \
  --run-slug openrouter-owl-alpha-current-full-pipeline-YYYYMMDD \
  --now 2026-05-27T17:45:05.559Z \
  > <private-evidence-root>/full-pipeline-summary.json
```

Expected summary properties:

- `ok` is true;
- provider validation is true;
- quality gate status is `pass`;
- safety flags remain no live provider call, no network, and no credential read;
- artifact paths are relative;
- the expected package artifacts exist.

### 6. Verify deterministic hash

```bash
sha256sum <private-evidence-root>/<package-root>/openrouter-owl-alpha-current-full-pipeline-YYYYMMDD/manifest.json
```

Expected hash for the recorded milestone:

```text
cc9b26b50b12031368a9399fcdd9d949af90f8dd8e21c2b8628a9a9ff4b3eaab
```

Rerun with identical inputs and explicit overwrite, then verify the hash remains unchanged.

```bash
cd <checkout-root>
npm run --silent validation:full-pipeline -- \
  fixtures/graph/valid/minimal-pass.json \
  --provider-report <private-evidence-root>/<provider-report> \
  --out-root <private-evidence-root>/<package-root> \
  --run-slug openrouter-owl-alpha-current-full-pipeline-YYYYMMDD \
  --now 2026-05-27T17:45:05.559Z \
  --allow-overwrite \
  > <private-evidence-root>/full-pipeline-summary-rerun.json

sha256sum <private-evidence-root>/<package-root>/openrouter-owl-alpha-current-full-pipeline-YYYYMMDD/manifest.json
```

### 7. Sanitization checks

Before reporting results, verify:

- artifact paths are relative;
- credential/secret marker scan returns no hits for package artifacts and summaries;
- summaries do not expose raw private evidence paths;
- the report describes this as lab validation, not production or launch readiness.

## Reporting checklist

Report only sanitized facts:

- lab host role, not private host internals;
- checkout commit;
- Node/npm/git versions if relevant;
- `npm ci` pass or fail;
- `npm run ci` pass or fail, with test and suite counts;
- full-pipeline summary path expressed relative to the private evidence root when possible;
- deterministic manifest hash and rerun result;
- whether package artifacts passed the credential/secret marker scan;
- whether DNS-name command strings avoided raw IP approval prompts.

Do not report credential material, raw provider response bodies, raw prompt bodies, or private evidence dumps.
