// Prompt-contract placeholders for future bounded Atliera agent proposals.
//
// This module is intentionally pure data plus validation helpers. It does not
// read environment, import provider SDKs, construct clients, open sockets, or
// execute prompts. The contracts describe what later provider wiring must
// preserve before any real model call is activated.

export const PROMPT_CONTRACT_SCHEMA_VERSION = "prompt_contract.v1" as const;

export type PromptContractSchemaVersion = typeof PROMPT_CONTRACT_SCHEMA_VERSION;

export type PromptContractOperation =
  | "propose.excerpts"
  | "propose.claims"
  | "propose.account_objects"
  | "summarize.lens";

export type PromptContractMode = "placeholder";

export type PromptContractInputRef =
  | "source_documents"
  | "accepted_excerpts"
  | "claims"
  | "account_objects"
  | "graph_bundle"
  | "workshop_lens";

export type PromptContractOutputRecordKind =
  | "evidence_excerpt"
  | "claim"
  | "claim_evidence"
  | "account_object"
  | "account_object_claim"
  | "lens_summary";

export interface PromptContract {
  readonly schema_version: PromptContractSchemaVersion;
  readonly id: string;
  readonly operation: PromptContractOperation;
  readonly mode: PromptContractMode;
  readonly required_input_refs: readonly PromptContractInputRef[];
  readonly allowed_output_record_kinds: readonly PromptContractOutputRecordKind[];
  readonly contract: string;
  readonly provider: null;
  readonly model: null;
}

function freezeContract(input: PromptContract): PromptContract {
  return Object.freeze({
    ...input,
    required_input_refs: Object.freeze([...input.required_input_refs]),
    allowed_output_record_kinds: Object.freeze([...input.allowed_output_record_kinds]),
  });
}

const CONTRACT_REQUIREMENTS =
  "Future implementations must cite existing source_document_id values, must not invent source, excerpt, claim, account-object, or relationship IDs, must emit only the allowed output record kinds, and must submit proposals through Graph validators and the quality gate before persistence or display.";

export const PROMPT_CONTRACTS: readonly PromptContract[] = Object.freeze([
  freezeContract({
    schema_version: PROMPT_CONTRACT_SCHEMA_VERSION,
    id: "prompt_propose_excerpts",
    operation: "propose.excerpts",
    mode: "placeholder",
    required_input_refs: ["source_documents"],
    allowed_output_record_kinds: ["evidence_excerpt"],
    contract:
      `${CONTRACT_REQUIREMENTS} Excerpt proposals must cite existing source_document_id values and keep literal spans verifiable against source text; paraphrases remain proposed unless a deterministic matcher accepts them.`,
    provider: null,
    model: null,
  }),
  freezeContract({
    schema_version: PROMPT_CONTRACT_SCHEMA_VERSION,
    id: "prompt_propose_claims",
    operation: "propose.claims",
    mode: "placeholder",
    required_input_refs: ["source_documents", "accepted_excerpts"],
    allowed_output_record_kinds: ["claim", "claim_evidence"],
    contract:
      `${CONTRACT_REQUIREMENTS} Claim proposals must cite existing source_document_id context through accepted excerpt evidence, must not invent supporting evidence, and must leave unsupported material visibly unverified or rejected by Graph validators and the quality gate.`,
    provider: null,
    model: null,
  }),
  freezeContract({
    schema_version: PROMPT_CONTRACT_SCHEMA_VERSION,
    id: "prompt_propose_account_objects",
    operation: "propose.account_objects",
    mode: "placeholder",
    required_input_refs: ["source_documents", "claims", "accepted_excerpts"],
    allowed_output_record_kinds: ["account_object", "account_object_claim"],
    contract:
      `${CONTRACT_REQUIREMENTS} Account-object proposals must cite existing source_document_id context through accepted excerpt-backed claims, must not invent claim links, and must preserve provenance so Graph validators and the quality gate can reject unsupported objects.`,
    provider: null,
    model: null,
  }),
  freezeContract({
    schema_version: PROMPT_CONTRACT_SCHEMA_VERSION,
    id: "prompt_summarize_lens",
    operation: "summarize.lens",
    mode: "placeholder",
    required_input_refs: ["graph_bundle", "workshop_lens", "source_documents"],
    allowed_output_record_kinds: ["lens_summary"],
    contract:
      `${CONTRACT_REQUIREMENTS} Lens summaries must cite existing source_document_id context through graph-backed evidence packets, must not invent new facts or hidden graph records, and must remain a derived view over Graph validators and the quality gate rather than a persistence bypass.`,
    provider: null,
    model: null,
  }),
]);

const PROMPT_CONTRACTS_BY_OPERATION: ReadonlyMap<PromptContractOperation, PromptContract> =
  new Map(PROMPT_CONTRACTS.map((contract) => [contract.operation, contract]));

export function listPromptContracts(): PromptContract[] {
  return PROMPT_CONTRACTS.map(clonePromptContract);
}

export function getPromptContract(operation: PromptContractOperation): PromptContract {
  const contract = PROMPT_CONTRACTS_BY_OPERATION.get(operation);
  if (contract === undefined) {
    throw new Error("prompt contract operation is not supported");
  }
  return clonePromptContract(contract);
}

function clonePromptContract(contract: PromptContract): PromptContract {
  return freezeContract({
    ...contract,
    required_input_refs: [...contract.required_input_refs],
    allowed_output_record_kinds: [...contract.allowed_output_record_kinds],
  });
}
