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
    tool_use_allowed: false,
    shell_access_allowed: false,
    file_access_allowed: false,
    web_search_allowed: false,
    plugins_allowed: false,
    retrieval_allowed: false,
    credential_material_committed: false,
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
