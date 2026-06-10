# Bounded Lab Deployment Execution Approval Packet

Status: inert-approval

This packet does not approve or execute the bounded lab deployment/probe slice. It defines the concrete scope that a later operator may approve or decline after this PR is merged. Until that separate explicit operator approval exists, current effective authorization remains none.

This packet is intentionally no-deploy and no-probe. It records how a future execution slice would be bounded, evidenced, stopped, and rolled back without committing hostnames, IP addresses, endpoints, credential material, or private evidence.

## Packet markers

- packet_ref: lab-bounded-deployment-execution-approval-packet
- packet_kind: bounded_lab_deployment_execution_approval_packet
- status: inert-approval
- current_effective_authorization: none
- execution_requires_separate_explicit_operator_approval_after_merge: true
- operator_decision_required_before_any_remote_touch: true
- exact_approved_commit_required: true
- exact approved commit: APPROVED_COMMIT_SHA
- supervised service start: LAB_SERVICE_NAME_REF
- optional /workshop shallow smoke: explicit later approval required
- single_lab_target_only: true
- runtime_mode_required: LAB_RUNTIME_MODE=fake

## Boundary markers

- authorizes_deployment_by_this_pr: false
- authorizes_remote_lab_probe_by_this_pr: false
- authorizes_service_start_by_this_pr: false
- authorizes_backup_execution_by_this_pr: false
- authorizes_restore_execution_by_this_pr: false
- authorizes_scheduler_install_by_this_pr: false
- authorizes_provider_call: false
- authorizes_graph_ingestion: false
- authorizes_production_write: false
- authorizes_cloud_provisioning_by_this_pr: false
- authorizes_dns_or_tls_change_by_this_pr: false
- authorizes_nginx_or_process_manager_install_by_this_pr: false
- provider_calls_executed_by_this_pr: 0
- provider_spend_by_this_pr: false
- deployment_readiness_claim: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Prerequisite refs for any later approval

A later operator approval must name the exact ref values used at execution time. This packet deliberately records only config-reference names and placeholders:

- LAB_DEPLOYMENT_TARGET_DESCRIPTOR_REF
- LAB_DEPLOYMENT_HEALTHCHECK_PLAN_REF
- LAB_HOST_SUPERVISION_PLAN_REF
- LAB_BACKUP_POLICY_PLAN_REF
- LAB_DEPLOYMENT_EXECUTION_PREFLIGHT_REF
- LAB_TARGET_HOST_REF
- LAB_PUBLIC_BASE_URL_REF
- LAB_BIND_HOST_REF
- LAB_SERVICE_NAME_REF
- LAB_BACKUP_ARTIFACT_ROOT_REF
- LAB_RESTORE_PROOF_ARTIFACT_REF
- APPROVED_COMMIT_SHA

The future approval must prove these refs resolve consistently with the merged plan-only contracts before any remote command, service start, probe, backup, restore, or scheduler step. If a ref is missing, endpoint-shaped where a logical ref is required, credential-shaped, inconsistent, or points at a non-lab target, execution must stop before any remote touch.

## Proposed future slice A: deploy, supervise, and probe fake-mode lab service

Slice A is the smallest side-effecting Gate 3 lab mechanics proof. It may be approved only by a later explicit operator decision against this packet.

Scope if approved later:

1. Verify local checkout and GitHub target commit match APPROVED_COMMIT_SHA.
2. Verify `npm run typecheck` and `npm run ci` pass from APPROVED_COMMIT_SHA before deployment.
3. Resolve LAB_TARGET_HOST_REF, LAB_PUBLIC_BASE_URL_REF, LAB_BIND_HOST_REF, LAB_SERVICE_NAME_REF, and LAB_RUNTIME_MODE=fake through the operator environment or deployment adapter.
4. Deploy exactly APPROVED_COMMIT_SHA to the single lab target named by LAB_TARGET_HOST_REF.
5. Start exactly the service named by LAB_SERVICE_NAME_REF under the supervision shape from LAB_HOST_SUPERVISION_PLAN_REF.
6. Run the approved `/healthz probe` against LAB_PUBLIC_BASE_URL_REF.
7. Run the optional `/workshop shallow smoke` only if the later operator approval includes it.
8. Capture sanitized evidence only: commit SHA, command categories, start/probe status, stable reason codes, boundary markers, and config-reference names.
9. Stop after the approved probes; do not broaden into TLS, DNS, nginx, process-manager installation, scheduler installation, provider calls, graph ingestion, or production writes unless separately approved.

Required stop conditions:

- APPROVED_COMMIT_SHA does not match the checked out commit.
- Local typecheck or CI fails before deployment.
- Any prerequisite ref is missing or inconsistent with the plan-only contracts.
- LAB_RUNTIME_MODE is not fake.
- The target is not the single lab target.
- Healthcheck, supervision, backup-policy, or execution-preflight contracts cannot be validated before execution.
- Service start fails or exits unexpectedly.
- `/healthz` fails, returns non-success status, returns malformed JSON, claims readiness beyond health, reports provider calls, or reports production writes.
- Any command would require a credential, host, URL, or endpoint literal to be committed.
- Any proposed operator action exceeds the later approval scope.

Rollback/teardown requirements:

- Stop the lab service if the supervised start happened.
- Restore the prior service state if the operator recorded one before start.
- Preserve sanitized evidence and stable reason codes.
- Do not retry automatically.
- Do not switch targets, commits, providers, process managers, domains, or backup stores without a new approval.

## Proposed future slice B: backup and restore proof

Backup/restore proof requires its own explicit approval choice. The operator may approve slice A only, or approve slice A plus slice B, but this packet does not authorize either.

Scope if approved later:

1. Verify LAB_BACKUP_POLICY_PLAN_REF and LAB_RESTORE_PROOF_ARTIFACT_REF match the merged backup-policy contract and local durable DB backup/restore contract.
2. Execute one lab backup against disposable lab data only.
3. Execute one restore proof before meaningful lab data is created.
4. Record sanitized evidence: artifact config refs, checksums or stable integrity markers, restore result, and boundary markers.
5. Leave scheduler installation disabled unless the later operator approval explicitly names scheduler installation as in scope.

Required stop conditions:

- Backup or restore would touch non-lab data.
- The backup artifact target is not represented by a config ref.
- Scheduler installation is required but not explicitly approved.
- The restore proof cannot be completed before meaningful lab data exists.
- Any raw DB path, credential path, host value, endpoint, or private artifact location would need to be committed.

Rollback/teardown requirements:

- Preserve the pre-restore lab DB state if the later approval requires it.
- Delete or quarantine temporary restore scratch data after evidence capture.
- Do not treat a successful restore proof as production disaster-recovery readiness.

## Operator decision form for the next step

After this packet is merged, the operator decision should answer exactly:

1. Do you approve slice A as written against APPROVED_COMMIT_SHA and the named config refs?
2. Does that approval include the optional `/workshop shallow smoke`?
3. Does that approval include slice B backup/restore proof, or should slice B remain a separate later decision?
4. What is the approval expiry time?
5. What is the maximum allowed cloud/operator spend for the approved slice, if any?
6. What is the rollback expectation if service start or `/healthz` fails?

A yes answer must still be bounded by this packet. A partial yes authorizes only the named subset. A no or defer keeps current_effective_authorization: none.

## Evidence that may be committed later

Only sanitized evidence may be committed in a later status PR:

- approval packet ref
- explicit operator approval ref
- APPROVED_COMMIT_SHA
- config-reference names used, not resolved values
- command category names, not credential material
- success/failure status and stable reason codes
- healthcheck status summary without raw private headers or bodies
- service state summary without private host values
- backup/restore integrity markers if slice B is approved
- all boundary markers, including readiness markers remaining false

## Evidence that must not be committed later

- resolved hostnames, IP addresses, URLs, endpoints, regions, account IDs, bucket names, private paths, credential paths, tokens, passwords, SSH key material, auth headers, raw request bodies, raw response bodies, provider payloads, model outputs, environment dumps, or process-manager secrets
- any statement that the lab host is production-ready, product-ready, launch-ready, or generally deployment-ready
- any suggestion that this packet creates standing approval

## Current non-goals

- No deployment.
- No remote lab host probing.
- No service start.
- No backup or restore execution.
- No scheduler, timer, cron, nginx, TLS, DNS, Certbot, PM2, systemd, or cloud provisioning change.
- No provider/model calls or spend.
- No graph ingestion.
- No production writes.
- No readiness claim.

## Next recommended work

The next step after this packet is merged is an explicit operator go/no-go decision against this bounded lab deployment execution approval packet. Without that fresh decision, current effective authorization remains none.
