import {
  assertSafeModelProviderRequest,
  type ModelProvider,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "./provider.ts";

export const CODEX_AUTH_MODEL_PROVIDER_BRIDGE_SCHEMA_VERSION = "atliera.codex_auth_model_provider_bridge.v1" as const;

export type CodexAuthBridgeRefusalReason =
  | "cli_missing"
  | "auth_missing"
  | "sandbox_unverified"
  | "structured_output_unverified"
  | "model_only_transport_unproven"
  | "tool_disable_unproven"
  | "shell_access_disable_unproven"
  | "file_access_disable_unproven"
  | "web_search_disable_unproven"
  | "plugin_disable_unproven"
  | "retrieval_disable_unproven"
  | "credential_neutrality_unproven"
  | "private_evidence_boundary_unproven";

export type CodexAuthModelOnlyTransportProofRefusalReason =
  | "transport_kind_mismatch"
  | "request_contract_unproven"
  | "response_contract_unproven"
  | "request_metadata_contract_unproven"
  | "response_schema_unproven"
  | "strict_json_unproven"
  | "tool_disable_unproven"
  | "shell_access_disable_unproven"
  | "file_access_disable_unproven"
  | "web_search_disable_unproven"
  | "plugin_disable_unproven"
  | "retrieval_disable_unproven"
  | "credential_neutrality_unproven"
  | "private_evidence_boundary_unproven"
  | "raw_evidence_committed"
  | "provider_calls_executed"
  | "provider_spend_observed";

export interface CodexAuthBridgeReadinessInput {
  readonly codexCliInstalled: boolean;
  readonly codexAuthPresent: boolean;
  readonly sandboxSmokePassed: boolean;
  readonly structuredOutputSupported: boolean;
  readonly modelOnlyTransportProven: boolean;
  readonly toolUseDisabled: boolean;
  readonly shellAccessDisabled: boolean;
  readonly fileAccessDisabled: boolean;
  readonly webSearchDisabled: boolean;
  readonly pluginsDisabled: boolean;
  readonly retrievalDisabled: boolean;
  readonly credentialNeutral: boolean;
  readonly privateEvidenceBoundaryProven: boolean;
}

export interface CodexAuthBridgeReadinessReport {
  readonly schema_version: typeof CODEX_AUTH_MODEL_PROVIDER_BRIDGE_SCHEMA_VERSION;
  readonly ok: boolean;
  readonly refusal_reasons: readonly CodexAuthBridgeRefusalReason[];
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_candidate_calls: false;
  readonly raw_evidence_committed: false;
  readonly tool_use_allowed: false;
  readonly shell_access_allowed: false;
  readonly file_access_allowed: false;
  readonly web_search_allowed: false;
  readonly plugins_allowed: false;
  readonly retrieval_allowed: false;
  readonly credential_material_committed: false;
}

export interface CodexAuthModelOnlyTransportProofInput {
  readonly transportKind: string;
  readonly acceptsModelProviderRequestOnly: boolean;
  readonly returnsModelProviderResponseOnly: boolean;
  readonly requestMetadataContractVerified: boolean;
  readonly responseSchemaVerified: boolean;
  readonly strictJsonVerified: boolean;
  readonly toolUseDisabled: boolean;
  readonly shellAccessDisabled: boolean;
  readonly fileAccessDisabled: boolean;
  readonly webSearchDisabled: boolean;
  readonly pluginsDisabled: boolean;
  readonly retrievalDisabled: boolean;
  readonly credentialNeutral: boolean;
  readonly privateEvidenceBoundaryProven: boolean;
  readonly rawEvidenceCommitted: boolean;
  readonly providerCallsExecuted: number;
  readonly spendUsd: number;
}

export interface CodexAuthModelOnlyTransportProofReport {
  readonly schema_version: typeof CODEX_AUTH_MODEL_PROVIDER_BRIDGE_SCHEMA_VERSION;
  readonly ok: boolean;
  readonly refusal_reasons: readonly CodexAuthModelOnlyTransportProofRefusalReason[];
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_candidate_calls: false;
  readonly raw_evidence_committed: false;
  readonly tool_use_allowed: false;
  readonly shell_access_allowed: false;
  readonly file_access_allowed: false;
  readonly web_search_allowed: false;
  readonly plugins_allowed: false;
  readonly retrieval_allowed: false;
  readonly credential_material_committed: false;
}

export interface CodexAuthModelOnlyGuarantee {
  readonly modelOnlyTransport: true;
  readonly toolUseDisabled: true;
  readonly shellAccessDisabled: true;
  readonly fileAccessDisabled: true;
  readonly webSearchDisabled: true;
  readonly pluginsDisabled: true;
  readonly retrievalDisabled: true;
  readonly credentialNeutral: true;
  readonly privateEvidenceOutsideRepo: true;
}

export interface CodexAuthModelProviderTransport {
  readonly kind: "model-only-codex-auth";
  generate(request: ModelProviderRequest): Promise<ModelProviderResponse>;
}

export interface CodexAuthModelProviderBridgeOptions {
  readonly name: string;
  readonly candidateModel: string;
  readonly guarantee: CodexAuthModelOnlyGuarantee;
  readonly transport: CodexAuthModelProviderTransport;
}

export interface CodexAuthModelProviderBridgeFromProofOptions {
  readonly name: string;
  readonly candidateModel: string;
  readonly proof: CodexAuthModelOnlyTransportProofReport;
  readonly transport: CodexAuthModelProviderTransport;
}

const SAFE_PROVIDER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REQUIRED_FALSE_METADATA_KEYS = [
  "tools",
  "plugins",
  "web_search",
  "retrieval",
  "shell_access",
  "file_access",
  "online_variant",
] as const;

export function evaluateCodexAuthBridgeReadiness(input: CodexAuthBridgeReadinessInput): CodexAuthBridgeReadinessReport {
  const snapshot = snapshotReadinessInput(input);
  const refusalReasons: CodexAuthBridgeRefusalReason[] = [];

  if (!snapshot.codexCliInstalled) refusalReasons.push("cli_missing");
  if (!snapshot.codexAuthPresent) refusalReasons.push("auth_missing");
  if (!snapshot.sandboxSmokePassed) refusalReasons.push("sandbox_unverified");
  if (!snapshot.structuredOutputSupported) refusalReasons.push("structured_output_unverified");
  if (!snapshot.modelOnlyTransportProven) refusalReasons.push("model_only_transport_unproven");
  if (!snapshot.toolUseDisabled) refusalReasons.push("tool_disable_unproven");
  if (!snapshot.shellAccessDisabled) refusalReasons.push("shell_access_disable_unproven");
  if (!snapshot.fileAccessDisabled) refusalReasons.push("file_access_disable_unproven");
  if (!snapshot.webSearchDisabled) refusalReasons.push("web_search_disable_unproven");
  if (!snapshot.pluginsDisabled) refusalReasons.push("plugin_disable_unproven");
  if (!snapshot.retrievalDisabled) refusalReasons.push("retrieval_disable_unproven");
  if (!snapshot.credentialNeutral) refusalReasons.push("credential_neutrality_unproven");
  if (!snapshot.privateEvidenceBoundaryProven) refusalReasons.push("private_evidence_boundary_unproven");

  return Object.freeze({
    schema_version: CODEX_AUTH_MODEL_PROVIDER_BRIDGE_SCHEMA_VERSION,
    ok: refusalReasons.length === 0,
    refusal_reasons: Object.freeze(refusalReasons),
    provider_calls_executed: 0,
    provider_spend: false,
    authorizes_candidate_calls: false,
    raw_evidence_committed: false,
    tool_use_allowed: false,
    shell_access_allowed: false,
    file_access_allowed: false,
    web_search_allowed: false,
    plugins_allowed: false,
    retrieval_allowed: false,
    credential_material_committed: false,
  });
}

export function evaluateCodexAuthModelOnlyTransportProof(
  input: CodexAuthModelOnlyTransportProofInput,
): CodexAuthModelOnlyTransportProofReport {
  const snapshot = snapshotModelOnlyTransportProofInput(input);
  const refusalReasons: CodexAuthModelOnlyTransportProofRefusalReason[] = [];

  if (snapshot.transportKind !== "model-only-codex-auth") refusalReasons.push("transport_kind_mismatch");
  if (!snapshot.acceptsModelProviderRequestOnly) refusalReasons.push("request_contract_unproven");
  if (!snapshot.returnsModelProviderResponseOnly) refusalReasons.push("response_contract_unproven");
  if (!snapshot.requestMetadataContractVerified) refusalReasons.push("request_metadata_contract_unproven");
  if (!snapshot.responseSchemaVerified) refusalReasons.push("response_schema_unproven");
  if (!snapshot.strictJsonVerified) refusalReasons.push("strict_json_unproven");
  if (!snapshot.toolUseDisabled) refusalReasons.push("tool_disable_unproven");
  if (!snapshot.shellAccessDisabled) refusalReasons.push("shell_access_disable_unproven");
  if (!snapshot.fileAccessDisabled) refusalReasons.push("file_access_disable_unproven");
  if (!snapshot.webSearchDisabled) refusalReasons.push("web_search_disable_unproven");
  if (!snapshot.pluginsDisabled) refusalReasons.push("plugin_disable_unproven");
  if (!snapshot.retrievalDisabled) refusalReasons.push("retrieval_disable_unproven");
  if (!snapshot.credentialNeutral) refusalReasons.push("credential_neutrality_unproven");
  if (!snapshot.privateEvidenceBoundaryProven) refusalReasons.push("private_evidence_boundary_unproven");
  if (snapshot.rawEvidenceCommitted) refusalReasons.push("raw_evidence_committed");
  if (snapshot.providerCallsExecuted !== 0) refusalReasons.push("provider_calls_executed");
  if (snapshot.spendUsd !== 0) refusalReasons.push("provider_spend_observed");

  return Object.freeze({
    schema_version: CODEX_AUTH_MODEL_PROVIDER_BRIDGE_SCHEMA_VERSION,
    ok: refusalReasons.length === 0,
    refusal_reasons: Object.freeze(refusalReasons),
    provider_calls_executed: 0,
    provider_spend: false,
    authorizes_candidate_calls: false,
    raw_evidence_committed: false,
    tool_use_allowed: false,
    shell_access_allowed: false,
    file_access_allowed: false,
    web_search_allowed: false,
    plugins_allowed: false,
    retrieval_allowed: false,
    credential_material_committed: false,
  });
}

export function createCodexAuthModelProviderBridgeFromProof(
  options: CodexAuthModelProviderBridgeFromProofOptions,
): CodexAuthModelProviderBridge {
  let name: string;
  let candidateModel: string;
  let proof: CodexAuthModelOnlyTransportProofReport;
  try {
    name = options.name;
    candidateModel = options.candidateModel;
    proof = options.proof;
  } catch {
    throw new Error("codex auth bridge options rejected");
  }
  if (!SAFE_PROVIDER_NAME.test(name)) {
    throw new Error("codex auth bridge provider name rejected");
  }
  if (!SAFE_MODEL_ID.test(candidateModel)) {
    throw new Error("codex auth bridge model rejected");
  }
  assertSafeSuccessfulTransportProofReport(proof);

  let transport: CodexAuthModelProviderTransport;
  let transportKind: string;
  try {
    transport = options.transport;
    transportKind = transport.kind;
  } catch {
    throw new Error("codex auth bridge options rejected");
  }
  if (transportKind !== "model-only-codex-auth") {
    throw new Error("codex auth bridge transport rejected");
  }
  return new CodexAuthModelProviderBridge({
    name,
    candidateModel,
    guarantee: Object.freeze({
      modelOnlyTransport: true,
      toolUseDisabled: true,
      shellAccessDisabled: true,
      fileAccessDisabled: true,
      webSearchDisabled: true,
      pluginsDisabled: true,
      retrievalDisabled: true,
      credentialNeutral: true,
      privateEvidenceOutsideRepo: true,
    }),
    transport,
  });
}

export class CodexAuthModelProviderBridge implements ModelProvider {
  readonly name: string;
  private readonly candidateModel: string;
  private readonly transport: CodexAuthModelProviderTransport;

  constructor(options: CodexAuthModelProviderBridgeOptions) {
    const snapshot = snapshotBridgeOptions(options);
    assertSafeBridgeGuarantee(snapshot.guarantee);
    this.name = snapshot.name;
    this.candidateModel = snapshot.candidateModel;
    this.transport = snapshot.transport;
  }

  async generate(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    assertSafeModelProviderRequest(request);
    if (request.model !== this.candidateModel) {
      throw new Error("codex auth bridge model mismatch");
    }
    assertNoToolRequestMetadata(request);

    let response: ModelProviderResponse;
    try {
      response = await this.transport.generate(request);
    } catch (error) {
      if (error instanceof Error && error.message === "codex auth bridge transport failed") {
        throw error;
      }
      throw new Error("codex auth bridge transport failed");
    }
    assertSafeModelProviderRequest(request);
    assertSafeCodexBridgeResponse(response, request, this.name, this.candidateModel);
    return Object.freeze({
      provider: response.provider,
      model: response.model,
      idempotencyKey: response.idempotencyKey,
      output: Object.freeze({
        excerpts: Object.freeze([...response.output.excerpts]) as never[],
        claims: Object.freeze([...response.output.claims]) as never[],
        account_objects: Object.freeze([...response.output.account_objects]) as never[],
      }),
      usage: Object.freeze({ ...response.usage }),
      cost: Object.freeze({ ...response.cost }),
    });
  }
}

function snapshotReadinessInput(input: CodexAuthBridgeReadinessInput): CodexAuthBridgeReadinessInput {
  try {
    return Object.freeze({
      codexCliInstalled: input.codexCliInstalled,
      codexAuthPresent: input.codexAuthPresent,
      sandboxSmokePassed: input.sandboxSmokePassed,
      structuredOutputSupported: input.structuredOutputSupported,
      modelOnlyTransportProven: input.modelOnlyTransportProven,
      toolUseDisabled: input.toolUseDisabled,
      shellAccessDisabled: input.shellAccessDisabled,
      fileAccessDisabled: input.fileAccessDisabled,
      webSearchDisabled: input.webSearchDisabled,
      pluginsDisabled: input.pluginsDisabled,
      retrievalDisabled: input.retrievalDisabled,
      credentialNeutral: input.credentialNeutral,
      privateEvidenceBoundaryProven: input.privateEvidenceBoundaryProven,
    });
  } catch {
    throw new Error("codex auth bridge readiness input rejected");
  }
}

function assertSafeSuccessfulTransportProofReport(proof: CodexAuthModelOnlyTransportProofReport): void {
  try {
    if (proof.schema_version !== CODEX_AUTH_MODEL_PROVIDER_BRIDGE_SCHEMA_VERSION) {
      throw new Error("invalid transport proof report");
    }
    if (proof.ok !== true) {
      throw new Error("invalid transport proof report");
    }
    if (!Array.isArray(proof.refusal_reasons) || proof.refusal_reasons.length !== 0) {
      throw new Error("invalid transport proof report");
    }
    if (
      proof.provider_calls_executed !== 0 ||
      proof.provider_spend !== false ||
      proof.authorizes_candidate_calls !== false ||
      proof.raw_evidence_committed !== false ||
      proof.tool_use_allowed !== false ||
      proof.shell_access_allowed !== false ||
      proof.file_access_allowed !== false ||
      proof.web_search_allowed !== false ||
      proof.plugins_allowed !== false ||
      proof.retrieval_allowed !== false ||
      proof.credential_material_committed !== false
    ) {
      throw new Error("invalid transport proof report");
    }
  } catch {
    throw new Error("codex auth model-only transport proof rejected");
  }
}

function snapshotModelOnlyTransportProofInput(
  input: CodexAuthModelOnlyTransportProofInput,
): CodexAuthModelOnlyTransportProofInput {
  try {
    const snapshot = Object.freeze({
      transportKind: input.transportKind,
      acceptsModelProviderRequestOnly: input.acceptsModelProviderRequestOnly,
      returnsModelProviderResponseOnly: input.returnsModelProviderResponseOnly,
      requestMetadataContractVerified: input.requestMetadataContractVerified,
      responseSchemaVerified: input.responseSchemaVerified,
      strictJsonVerified: input.strictJsonVerified,
      toolUseDisabled: input.toolUseDisabled,
      shellAccessDisabled: input.shellAccessDisabled,
      fileAccessDisabled: input.fileAccessDisabled,
      webSearchDisabled: input.webSearchDisabled,
      pluginsDisabled: input.pluginsDisabled,
      retrievalDisabled: input.retrievalDisabled,
      credentialNeutral: input.credentialNeutral,
      privateEvidenceBoundaryProven: input.privateEvidenceBoundaryProven,
      rawEvidenceCommitted: input.rawEvidenceCommitted,
      providerCallsExecuted: input.providerCallsExecuted,
      spendUsd: input.spendUsd,
    });
    if (typeof snapshot.transportKind !== "string") {
      throw new Error("invalid transport proof");
    }
    for (const value of [
      snapshot.acceptsModelProviderRequestOnly,
      snapshot.returnsModelProviderResponseOnly,
      snapshot.requestMetadataContractVerified,
      snapshot.responseSchemaVerified,
      snapshot.strictJsonVerified,
      snapshot.toolUseDisabled,
      snapshot.shellAccessDisabled,
      snapshot.fileAccessDisabled,
      snapshot.webSearchDisabled,
      snapshot.pluginsDisabled,
      snapshot.retrievalDisabled,
      snapshot.credentialNeutral,
      snapshot.privateEvidenceBoundaryProven,
      snapshot.rawEvidenceCommitted,
    ]) {
      if (typeof value !== "boolean") {
        throw new Error("invalid transport proof");
      }
    }
    if (!Number.isInteger(snapshot.providerCallsExecuted) || snapshot.providerCallsExecuted < 0) {
      throw new Error("invalid transport proof");
    }
    if (typeof snapshot.spendUsd !== "number" || !Number.isFinite(snapshot.spendUsd) || snapshot.spendUsd < 0) {
      throw new Error("invalid transport proof");
    }
    return snapshot;
  } catch {
    throw new Error("codex auth model-only transport proof input rejected");
  }
}

function snapshotBridgeOptions(options: CodexAuthModelProviderBridgeOptions): CodexAuthModelProviderBridgeOptions {
  try {
    const snapshot = Object.freeze({
      name: options.name,
      candidateModel: options.candidateModel,
      guarantee: options.guarantee,
      transport: options.transport,
    });
    if (!SAFE_PROVIDER_NAME.test(snapshot.name)) {
      throw new Error("codex auth bridge provider name rejected");
    }
    if (!SAFE_MODEL_ID.test(snapshot.candidateModel)) {
      throw new Error("codex auth bridge model rejected");
    }
    if (snapshot.transport.kind !== "model-only-codex-auth") {
      throw new Error("codex auth bridge transport rejected");
    }
    return snapshot;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("codex auth bridge")) {
      throw error;
    }
    throw new Error("codex auth bridge options rejected");
  }
}

function assertSafeBridgeGuarantee(guarantee: CodexAuthModelOnlyGuarantee): void {
  try {
    const required = [
      guarantee.modelOnlyTransport,
      guarantee.toolUseDisabled,
      guarantee.shellAccessDisabled,
      guarantee.fileAccessDisabled,
      guarantee.webSearchDisabled,
      guarantee.pluginsDisabled,
      guarantee.retrievalDisabled,
      guarantee.credentialNeutral,
      guarantee.privateEvidenceOutsideRepo,
    ];
    if (!required.every((value) => value === true)) {
      throw new Error("codex auth bridge guarantee rejected");
    }
  } catch {
    throw new Error("codex auth bridge guarantee rejected");
  }
}

function assertNoToolRequestMetadata(request: ModelProviderRequest): void {
  if (request.metadata.codex_auth_bridge !== "model_only") {
    throw new Error("codex auth bridge metadata missing model-only marker");
  }
  for (const key of REQUIRED_FALSE_METADATA_KEYS) {
    if (request.metadata[key] !== "false") {
      throw new Error("codex auth bridge request surface rejected");
    }
  }
}

function assertSafeCodexBridgeResponse(
  response: ModelProviderResponse,
  request: ModelProviderRequest,
  providerName: string,
  candidateModel: string,
): void {
  if (response.provider !== providerName || response.model !== candidateModel || response.idempotencyKey !== request.idempotencyKey) {
    throw new Error("codex auth bridge response rejected");
  }
  if (!Array.isArray(response.output.excerpts) || !Array.isArray(response.output.claims) || !Array.isArray(response.output.account_objects)) {
    throw new Error("codex auth bridge response rejected");
  }
  if (!Number.isInteger(response.usage.inputTokens) || !Number.isInteger(response.usage.outputTokens) || !Number.isInteger(response.usage.totalTokens)) {
    throw new Error("codex auth bridge response rejected");
  }
  if (response.usage.inputTokens + response.usage.outputTokens !== response.usage.totalTokens) {
    throw new Error("codex auth bridge response rejected");
  }
  if (response.cost.currency !== "USD" || typeof response.cost.amount !== "number" || !Number.isFinite(response.cost.amount) || response.cost.amount < 0) {
    throw new Error("codex auth bridge response rejected");
  }
}
