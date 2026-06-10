# Lab Bounded Deployment Slice A Execution Status

Status: active

This runbook records the approved bounded lab deployment/probe slice A execution performed after the inert approval packet was merged. The operator explicitly approved items 1 and 2 from the decision form: slice A as written and the optional `/workshop` shallow smoke. Slice B backup/restore proof was not approved or executed in this slice.

This document is sanitized. It records config-reference names, command categories, stable result codes, and boundary markers only. It does not commit resolved hostnames, IP addresses, URLs, endpoint values, credential material, token paths, private evidence paths, raw service logs, raw request bodies, raw response bodies, or private artifact locations.

Boundary markers:

- current_effective_authorization: none
- approval_packet_ref: lab-bounded-deployment-execution-approval-packet
- explicit_operator_approval_ref: user-approved-decision-items-1-and-2
- approved_commit: d144035905f12eeabc32c8da3f4a3dbb4b5a1f4d
- runtime_mode: fake
- target_ref: LAB_TARGET_HOST_REF
- bind_host_ref: LAB_BIND_HOST_REF
- public_base_url_ref: LAB_PUBLIC_BASE_URL_REF
- service_name_ref: LAB_SERVICE_NAME_REF
- slice_a_deployment_executed: true
- slice_a_service_start_executed: true
- slice_a_healthz_probe_executed: true
- slice_a_workshop_shallow_smoke_executed: true
- slice_b_backup_restore_approved: false
- backup_execution_executed_by_this_slice: false
- restore_execution_executed_by_this_slice: false
- scheduler_install_executed_by_this_slice: false
- nginx_tls_dns_change_executed_by_this_slice: false
- process_manager_install_executed_by_this_slice: false
- cloud_provisioning_executed_by_this_slice: false
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- graph_ingestion_executed_by_this_slice: false
- production_writes_executed_by_this_slice: false
- deployment_readiness_claim: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Approved scope

Approved scope for this slice:

1. Verify local checkout and approved commit match.
2. Run local `npm run ci` at the approved commit before any lab touch.
3. Transfer a source archive derived from the approved commit to the single lab target represented by `LAB_TARGET_HOST_REF`.
4. Prepare the lab release from the archive and run dependency install plus local typecheck on the lab target.
5. Start the fake-mode Workshop service with:
   - `LAB_RUNTIME_MODE=fake`
   - `LAB_TARGET_HOST_REF`
   - `LAB_BIND_HOST_REF`
   - `LAB_PUBLIC_BASE_URL_REF`
   - `LAB_SERVICE_NAME_REF`
6. Run the approved `/healthz` probe.
7. Run the approved optional `/workshop` shallow smoke.
8. Stop the service after the approved probes.
9. Commit only sanitized status evidence.

Explicitly not approved in this slice:

- Slice B backup/restore proof.
- Scheduler, timer, cron, systemd, PM2, nginx, TLS, DNS, Certbot, or process-manager installation.
- Cloud provisioning or AWS API/CLI calls.
- Provider/model calls or spend.
- Graph ingestion.
- Production writes.
- Any deployment, production, product, or launch readiness claim.

## Execution results

| Stage | Result | Sanitized evidence |
| --- | --- | --- |
| Approval packet present | pass | `lab-bounded-deployment-execution-approval-packet` was merged before execution. |
| Explicit operator approval | pass | User approved decision items 1 and 2 only. |
| Approved commit match | pass | Local checkout matched `d144035905f12eeabc32c8da3f4a3dbb4b5a1f4d`. |
| Local pre-deploy CI | pass | `npm run ci` passed at the approved commit: 1092 tests passed and gate fixture valid passed. |
| Single lab target access | pass | SSH access to `LAB_TARGET_HOST_REF` succeeded; no resolved target value is committed. |
| Source archive transfer | pass | Archive was generated from the approved commit and transferred to the lab target. |
| Lab release preparation | pass | Release extracted from the approved archive; lab-side commit marker matched the approved commit. |
| Lab dependency install | pass | Lockfile install completed on the lab target without provider/model calls. |
| Lab typecheck | pass | Lab-side `npm run typecheck` passed. |
| Fake-mode service start | pass | Service reached listening state under `LAB_SERVICE_NAME_REF`. |
| `/healthz` probe | pass | Probe returned the expected fake-mode health shape with `providerCallsMade: 0`, `productionWrites: false`, and readiness claims false. |
| Optional `/workshop` shallow smoke | pass | Authenticated shallow smoke returned HTML containing the expected Workshop shell and Signals/Maps/Plays markers. |
| Teardown | pass | Service was stopped after the approved probes and no lab service response remained on the approved local bind. |

## Stop conditions observed

No stop condition fired. The slice would have stopped before or during execution if any of these had occurred:

- approved commit mismatch
- local CI failure before remote touch
- missing lab target access
- lab-side release/commit marker mismatch
- lab-side typecheck failure
- runtime mode other than fake
- service start failure or early exit
- `/healthz` failure, malformed response, provider call marker, production write marker, or readiness claim
- `/workshop` shallow-smoke failure
- any need to commit resolved target values, credentials, private paths, raw logs, raw bodies, or private evidence
- any need to broaden into unapproved backup/restore execution, schedulers, process managers, nginx/TLS/DNS, providers, graph ingestion, or production writes

## Sanitization notes

Committed evidence intentionally excludes:

- resolved hostnames, IP addresses, URLs, regions, account IDs, bucket names, private paths, credential paths, auth tokens, SSH key paths, auth headers, raw service logs, raw request bodies, raw response bodies, environment dumps, provider payloads, and model outputs
- npm install logs, server listening JSON, HTML response bodies, and local/remote shell transcripts
- any statement that the lab host is generally deployment-ready

The sanitized committed facts are limited to commit identity, config-reference names, stage names, pass/fail outcomes, stable boundary markers, and stable zero-call/no-write markers.

## Current interpretation

This slice proves only that the merged fake-mode Workshop server can be packaged from the approved commit, prepared on the lab target, started under a bounded supervised shell session, probed at `/healthz`, shallow-smoked at `/workshop`, and stopped afterward.

It does not prove persistent deployment, nginx/TLS/domain readiness, scheduler readiness, backup/restore execution, provider/model operation, graph ingestion, production safety, or launch readiness.

## Next recommended work

The next Gate 3 decision now requires explicit operator selection of the next scoped slice after slice B and Gate 3 status reconciliation. Any further lab expansion, scheduler/backend wiring, nginx/TLS/domain work, provider calls, graph ingestion, production writes, or readiness claims remain out of scope until separately approved.
