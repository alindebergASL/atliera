# Lab S3-compatible artifact validation runbook

This runbook is the operator checklist for Atliera's first real S3-compatible `ArtifactStore` validation. It is intentionally lab-only and does not create production infrastructure, choose app deployment wiring, or store credentials in the repository.

Use it after the local filesystem emulator smoke path has passed and before treating durable artifact storage as production-ready.

## Goal

Validate the existing SDK-neutral artifact-storage boundary against a real S3-compatible backend or a separately documented high-fidelity provider emulator.

The run must prove only the current `S3ArtifactStore` contract:

- text artifact round trip;
- missing object returns the not-found shape;
- last-write-wins overwrite behavior;
- prefix isolation;
- max-payload refusal before backend write;
- sanitized report output.

It must not imply readiness for unrelated provider features, application deployment, lifecycle retention, object lock, multipart uploads, listing semantics, or model-provider execution.

## Non-goals

Do not use this runbook to:

- create or validate a production bucket;
- wire app/server/worker launch code to S3;
- add hardcoded bucket, region, endpoint, account, host, mount path, or credential values to source files;
- commit generated validation artifacts that contain account-specific infrastructure names;
- give model/provider code access to storage credentials;
- test S3 Files mount behavior without a separate mount-specific validation note.

## Required inputs

Before creating or using any lab bucket, record an explicit pre-provisioning approval checkpoint outside the repository. The approval must state that this is lab-only validation, not production storage setup.

Record these outside the repository before the run:

- operator approval reference;
- cloud account or S3-compatible provider account reference;
- region or endpoint reference;
- validation bucket name;
- validation prefix, scoped to this run family;
- run-scoped probe id;
- IAM role/user or equivalent credential scope;
- cleanup commitment and expected retention window;
- evidence artifact location for the sanitized report;
- whether the backend is direct object API, provider emulator, or filesystem/mount interface.

The bucket, endpoint, account, and credential details must remain in the operator environment, secret manager, or private run notes, not in committed source.

## Bucket and access guardrails

For a lab AWS S3 bucket, require:

- public access block enabled;
- server-side encryption enabled;
- bucket owner enforced or documented object ownership behavior;
- least-privilege IAM scoped to the validation bucket and run prefix;
- no production data, customer data, or legacy account-research exports;
- lifecycle expiration for validation objects or a documented manual cleanup step;
- object listing permissions only if the concrete cleanup process needs them;
- credentials issued for the validation run or a narrowly scoped lab role, not broad administrator credentials.

For non-AWS S3-compatible services, record equivalent controls for public exposure, encryption, credential scope, retention, and cleanup.

## Pre-run local smoke

Run the deterministic filesystem-backed CLI smoke first. It validates Atliera's injected-client boundary without network or credentials:

```bash
tmp=$(mktemp -d)
trap 'rm -rf "$tmp" /tmp/atliera-s3-filesystem-smoke.json' EXIT
npm run --silent s3:compatibility:filesystem -- \
  --root-dir "$tmp" \
  --bucket atliera-validation-test \
  --prefix validation-prefix \
  --probe-id local-smoke-1 \
  >/tmp/atliera-s3-filesystem-smoke.json
python3 - <<'PY'
import json
p=json.load(open('/tmp/atliera-s3-filesystem-smoke.json'))
assert p['ok'] is True
assert p['backend']['client']=='filesystem_s3_compatibility'
assert p['report']['ok'] is True
print('filesystem S3 compatibility smoke ok')
PY
```

The filesystem smoke report must be described as emulator evidence only. It does not prove IAM, signing, endpoint networking, bucket policy, lifecycle, consistency, multipart, object lock, or network-failure behavior.

## Real backend validation shape

The real-backend validation command or script must be added in a separate PR from this runbook unless an existing approved operator tool already supplies it.

That tool must:

- require explicit bucket, prefix, and probe id inputs;
- require explicit region or endpoint inputs when the selected client needs them;
- read credentials only through the operator's approved credential chain or secret lookup;
- construct the provider client outside `S3ArtifactStore` and pass it as an injected client;
- call `validateS3ArtifactStoreCompatibility({ client, bucket, prefix, probeId })`;
- emit a sanitized report that excludes bucket, prefix, endpoint, account, signed URL, credential names, and raw backend errors;
- return non-zero when any validation check fails;
- write evidence only to the operator-selected artifact location;
- leave cleanup to an explicit operator step or a documented lifecycle rule.

Do not broaden the `S3ArtifactStore` adapter to import SDKs, read env, or choose infrastructure defaults. Provider-specific client construction belongs in lab/deploy wiring only.

## Evidence to capture

Store a private run note with:

- repository commit SHA used for the run;
- operator approval reference;
- backend type: direct object API, provider emulator, or mount/filesystem interface;
- sanitized validation report path or artifact reference;
- validation command name and version or script commit;
- check names and pass/fail statuses;
- cleanup method and cleanup outcome reference;
- any backend mismatch that requires a follow-up contract or implementation PR.

The committed PR summary should include only non-secret evidence:

- commit SHA;
- backend type;
- sanitized report status;
- validation check names and statuses;
- cleanup outcome reference if safe to disclose;
- caveats and follow-up issues.

## Failure handling

If validation fails:

1. Preserve the sanitized report.
2. Do not retry with broader permissions until the failure category is understood.
3. Classify the failure as one of:
   - validation tool/setup issue;
   - IAM/credential/scope issue;
   - S3-compatible behavior mismatch;
   - Atliera adapter contract issue;
   - cleanup/retention issue.
4. Open a targeted follow-up PR or issue before moving to model-provider validation.

Real behavior mismatches should revise the contract or adapter in small PRs. Do not paper over mismatches by making product code depend on a provider-specific quirk unless the architecture docs explicitly accept that quirk.

## Exit criteria

The durable artifact-storage validation step is satisfied when:

- local filesystem smoke passed;
- real S3-compatible backend or documented high-fidelity emulator validation passed, or failed safely with preserved evidence and a follow-up path;
- cleanup outcome is recorded;
- no bucket, endpoint, account, host, credential, or production path was hardcoded into source;
- any discovered contract gaps are tracked;
- the transition document can point to the validation evidence before model-provider validation begins.
