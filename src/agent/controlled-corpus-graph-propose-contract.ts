import type { PromptContractOperation } from "./prompt-contracts.ts";
import type { ModelProviderOperation } from "../model/provider.ts";

export const CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION = "controlled_corpus_graph_propose_prompt.v1" as const;

export type ControlledCorpusGraphProposePromptSchemaVersion = typeof CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION;

export type ControlledCorpusGraphProposeRole = "representative" | "edge-case" | "calibration";

export type ControlledCorpusGraphProposePromptMode = "no-spend-contract";

export type ControlledCorpusGraphProposeResponseKey = "excerpts" | "claims" | "account_objects" | "lens_summaries";

export type ControlledCorpusGraphProposeBlockedAction =
  | "live_provider_rerun"
  | "provider_comparison"
  | "corpus_expansion"
  | "launch_readiness_claim"
  | "product_readiness_claim";

export interface BuildControlledCorpusGraphProposePromptContractInput {
  readonly role: ControlledCorpusGraphProposeRole;
}

export interface ControlledCorpusGraphProposePromptContract {
  readonly schema_version: ControlledCorpusGraphProposePromptSchemaVersion;
  readonly operation: ModelProviderOperation;
  readonly role: ControlledCorpusGraphProposeRole;
  readonly mode: ControlledCorpusGraphProposePromptMode;
  readonly prompt_contract_operations: readonly PromptContractOperation[];
  readonly required_response_keys: readonly ControlledCorpusGraphProposeResponseKey[];
  readonly prompt_template: string;
  readonly launch_readiness_claim: false;
  readonly approves_live_provider_call: false;
  readonly approves_provider_spend: false;
  readonly approves_expansion_or_comparison: false;
  readonly blocked_next_actions: readonly ControlledCorpusGraphProposeBlockedAction[];
}

const ROLES: readonly ControlledCorpusGraphProposeRole[] = ["representative", "edge-case", "calibration"];

const PROMPT_CONTRACT_OPERATIONS: readonly PromptContractOperation[] = [
  "propose.excerpts",
  "propose.claims",
  "propose.account_objects",
  "summarize.lens",
];

const REQUIRED_RESPONSE_KEYS: readonly ControlledCorpusGraphProposeResponseKey[] = [
  "excerpts",
  "claims",
  "account_objects",
  "lens_summaries",
];

const BLOCKED_NEXT_ACTIONS: readonly ControlledCorpusGraphProposeBlockedAction[] = [
  "live_provider_rerun",
  "provider_comparison",
  "corpus_expansion",
  "launch_readiness_claim",
  "product_readiness_claim",
];

const ROLE_INSTRUCTIONS: Readonly<Record<ControlledCorpusGraphProposeRole, string>> = Object.freeze({
  representative:
    "Focus on normal account-shape evidence. Prefer material account intelligence that can distinguish this account from a generic template.",
  "edge-case":
    "Handle sparse, ambiguous, or conflicting evidence cautiously. If support is thin, return empty arrays for unsupported structures rather than filling gaps.",
  calibration:
    "Treat this as a known expected weak/useful/failure calibration. Preserve the evidence outcome without forcing usefulness when the evidence does not support it.",
});

const BASE_PROMPT_TEMPLATE = `Controlled corpus graph.propose remediation contract.

Return only strict JSON. Do not return markdown, prose, commentary, code fences, or keys outside this schema:
{
  "excerpts": [
    {
      "id": "safe internal proposal id",
      "source_document_id": "existing source_document_id only",
      "quote": "non-empty literal source span",
      "rationale": "short non-private reason this span matters"
    }
  ],
  "claims": [
    {
      "id": "safe internal proposal id",
      "text": "specific account claim grounded in excerpts",
      "supporting_excerpt_ids": ["existing proposed excerpt id"],
      "confidence": "high | medium | low"
    }
  ],
  "account_objects": [
    {
      "id": "safe internal proposal id",
      "kind": "signal | map | play | risk | relationship | milestone",
      "label": "short account-object label",
      "supporting_claim_ids": ["existing proposed claim id"],
      "lens_targets": ["Signals", "Maps", "Plays"],
      "usefulness_reason": "why this object can support a graph-backed lens"
    }
  ],
  "lens_summaries": [
    {
      "lens": "Signals | Maps | Plays",
      "supporting_account_object_ids": ["existing proposed account_object id"],
      "summary": "short graph-backed summary; empty if unsupported"
    }
  ]
}

Grounding rules:
- Internal proposal ids may be generated only to connect records within this JSON object; existing source_document_id values must come from supplied source documents.
- Do not invent source_document_id values, source evidence, relationships, private identifiers, or facts.
- Every claim must cite supporting_excerpt_ids from the excerpts array.
- Every account object must cite supporting_claim_ids from the claims array.
- Every lens summary must cite supporting_account_object_ids from the account_objects array.
- Do not include private identifiers, credential details, private paths, headers, wrapper logs, or raw provider diagnostics.
- If evidence is insufficient, return an empty array for the unsupported section instead of unsupported narrative.
- Prefer specific, material, account-distinguishing facts over generic account-intelligence language.
- This prompt contract does not approve provider calls, provider spend, comparison, expansion, launch readiness, or product readiness.`;

function snapshotInput(input: BuildControlledCorpusGraphProposePromptContractInput): { role: ControlledCorpusGraphProposeRole } {
  let role: unknown;
  try {
    role = input.role;
  } catch {
    throw new Error("controlled corpus graph propose role is not supported");
  }
  if (!ROLES.includes(role as ControlledCorpusGraphProposeRole)) {
    throw new Error("controlled corpus graph propose role is not supported");
  }
  return { role: role as ControlledCorpusGraphProposeRole };
}

function freezeContract(
  contract: ControlledCorpusGraphProposePromptContract,
): ControlledCorpusGraphProposePromptContract {
  return Object.freeze({
    ...contract,
    prompt_contract_operations: Object.freeze([...contract.prompt_contract_operations]),
    required_response_keys: Object.freeze([...contract.required_response_keys]),
    blocked_next_actions: Object.freeze([...contract.blocked_next_actions]),
  });
}

export function buildControlledCorpusGraphProposePromptContract(
  input: BuildControlledCorpusGraphProposePromptContractInput,
): ControlledCorpusGraphProposePromptContract {
  const snapshot = snapshotInput(input);
  return freezeContract({
    schema_version: CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION,
    operation: "graph.propose",
    role: snapshot.role,
    mode: "no-spend-contract",
    prompt_contract_operations: PROMPT_CONTRACT_OPERATIONS,
    required_response_keys: REQUIRED_RESPONSE_KEYS,
    prompt_template: `${BASE_PROMPT_TEMPLATE}\n\nRole instruction: ${ROLE_INSTRUCTIONS[snapshot.role]}`,
    launch_readiness_claim: false,
    approves_live_provider_call: false,
    approves_provider_spend: false,
    approves_expansion_or_comparison: false,
    blocked_next_actions: BLOCKED_NEXT_ACTIONS,
  });
}

export function listControlledCorpusGraphProposePromptContracts(): ControlledCorpusGraphProposePromptContract[] {
  return ROLES.map((role) => buildControlledCorpusGraphProposePromptContract({ role }));
}
