type ControlledCorpusV2Role = "representative" | "edge-case" | "calibration";

type UsefulnessClassification =
  | "useful_bounded_signal"
  | "weak_but_structurally_valid"
  | "hard_invariant_blocked";

export interface ControlledCorpusV2UsefulnessFact {
  account_ref: string;
  role: ControlledCorpusV2Role;
  output_counts: Readonly<{
    excerpts: number;
    claims: number;
    account_objects: number;
  }>;
  hard_invariants: Readonly<{
    v2_contract_validated: boolean;
    canonical_account_ref: boolean;
    no_invented_ids: boolean;
    all_claims_supported: boolean;
    all_account_objects_supported: boolean;
    no_private_leakage: boolean;
  }>;
  soft_quality: Readonly<{
    materiality: boolean;
    specificity: boolean;
    account_usefulness: boolean;
    lens_usefulness: boolean;
    source_fit: boolean;
  }>;
}

export interface ControlledCorpusV2UsefulnessAssessment {
  ok: boolean;
  status: "pass" | "weak-but-valid" | "fail";
  overall_classification: UsefulnessClassification;
  metrics: Readonly<{
    total_accounts: number;
    useful_accounts: number;
    weak_accounts: number;
    hard_blocked_accounts: number;
    roles: Readonly<Record<ControlledCorpusV2Role, number>>;
    output_counts: Readonly<{
      excerpts: number;
      claims: number;
      account_objects: number;
    }>;
  }>;
  safety: Readonly<{
    provider_calls_executed_by_assessment: 0;
    provider_spend_by_assessment: false;
    raw_or_model_output_read_by_assessment: false;
    authorizes_product_preview_run: false;
    authorizes_provider_call: false;
    authorizes_default_model_selection: false;
  }>;
  launch_readiness_claim: false;
}

const FACT_KEYS = ["account_ref", "role", "output_counts", "hard_invariants", "soft_quality"] as const;
const COUNTS_KEYS = ["excerpts", "claims", "account_objects"] as const;
const HARD_KEYS = [
  "v2_contract_validated",
  "canonical_account_ref",
  "no_invented_ids",
  "all_claims_supported",
  "all_account_objects_supported",
  "no_private_leakage",
] as const;
const SOFT_KEYS = ["materiality", "specificity", "account_usefulness", "lens_usefulness", "source_fit"] as const;
const ROLES: ControlledCorpusV2Role[] = ["representative", "edge-case", "calibration"];
const SAFE_ACCOUNT_REF = /^acct-[a-z0-9][a-z0-9-]{0,63}$/;
export function validateControlledCorpusV2UsefulnessFacts(input: unknown): readonly ControlledCorpusV2UsefulnessFact[] {
  try {
    const arr = snapshotArray(input, "root");
    if (arr.length < 3 || arr.length > 5) throw new Error("expected 3-5 accounts");

    const refs = new Set<string>();
    const roleCounts = new Map<ControlledCorpusV2Role, number>(ROLES.map((role) => [role, 0]));
    const facts = arr.map((entry, index) => {
      const fact = snapshotFact(entry, `fact ${index}`);
      if (refs.has(fact.account_ref)) throw new Error("duplicate account_ref");
      refs.add(fact.account_ref);
      roleCounts.set(fact.role, (roleCounts.get(fact.role) ?? 0) + 1);
      return fact;
    });

    for (const role of ROLES) {
      if ((roleCounts.get(role) ?? 0) !== 1) throw new Error(`missing unique role ${role}`);
    }

    return Object.freeze(facts);
  } catch {
    throw new Error("controlled-corpus v2 usefulness facts rejected");
  }
}

export function assessControlledCorpusV2UsefulnessFacts(
  input: readonly ControlledCorpusV2UsefulnessFact[] | unknown,
): ControlledCorpusV2UsefulnessAssessment {
  const facts = validateControlledCorpusV2UsefulnessFacts(input);

  let useful = 0;
  let weak = 0;
  let hardBlocked = 0;
  const roleTotals: Record<ControlledCorpusV2Role, number> = {
    representative: 0,
    "edge-case": 0,
    calibration: 0,
  };
  const outputCounts = { excerpts: 0, claims: 0, account_objects: 0 };

  for (const fact of facts) {
    roleTotals[fact.role] += 1;
    outputCounts.excerpts += fact.output_counts.excerpts;
    outputCounts.claims += fact.output_counts.claims;
    outputCounts.account_objects += fact.output_counts.account_objects;

    const hardOk = HARD_KEYS.every((key) => fact.hard_invariants[key]);
    const softOk = SOFT_KEYS.every((key) => fact.soft_quality[key]);
    if (!hardOk) hardBlocked += 1;
    else if (!softOk) weak += 1;
    else useful += 1;
  }

  const status = hardBlocked > 0 ? "fail" : weak > 0 ? "weak-but-valid" : "pass";
  const overall: UsefulnessClassification =
    status === "pass"
      ? "useful_bounded_signal"
      : status === "weak-but-valid"
        ? "weak_but_structurally_valid"
        : "hard_invariant_blocked";

  return Object.freeze({
    ok: status === "pass",
    status,
    overall_classification: overall,
    metrics: Object.freeze({
      total_accounts: facts.length,
      useful_accounts: useful,
      weak_accounts: weak,
      hard_blocked_accounts: hardBlocked,
      roles: Object.freeze({ ...roleTotals }),
      output_counts: Object.freeze(outputCounts),
    }),
    safety: Object.freeze({
      provider_calls_executed_by_assessment: 0,
      provider_spend_by_assessment: false,
      raw_or_model_output_read_by_assessment: false,
      authorizes_product_preview_run: false,
      authorizes_provider_call: false,
      authorizes_default_model_selection: false,
    }),
    launch_readiness_claim: false,
  });
}

function snapshotFact(input: unknown, label: string): ControlledCorpusV2UsefulnessFact {
  const obj = snapshotObject(input, label, FACT_KEYS);
  const accountRef = obj.account_ref;
  if (typeof accountRef !== "string" || !SAFE_ACCOUNT_REF.test(accountRef)) throw new Error("unsafe account_ref");
  const role = obj.role;
  if (!isRole(role)) throw new Error("unsafe role");

  return Object.freeze({
    account_ref: accountRef,
    role,
    output_counts: snapshotCounts(obj.output_counts, `${label}.output_counts`),
    hard_invariants: snapshotBooleanObject(obj.hard_invariants, `${label}.hard_invariants`, HARD_KEYS),
    soft_quality: snapshotBooleanObject(obj.soft_quality, `${label}.soft_quality`, SOFT_KEYS),
  });
}

function snapshotCounts(input: unknown, label: string): ControlledCorpusV2UsefulnessFact["output_counts"] {
  const obj = snapshotObject(input, label, COUNTS_KEYS);
  const out: Record<(typeof COUNTS_KEYS)[number], number> = {
    excerpts: 0,
    claims: 0,
    account_objects: 0,
  };
  for (const key of COUNTS_KEYS) {
    const value = obj[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) throw new Error("invalid count");
    out[key] = value;
  }
  return Object.freeze(out);
}

function snapshotBooleanObject<const K extends readonly string[]>(input: unknown, label: string, keys: K): Readonly<Record<K[number], boolean>> {
  const obj = snapshotObject(input, label, keys) as Record<string, unknown>;
  const out = Object.create(null) as Record<string, boolean>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value !== "boolean") throw new Error("invalid boolean");
    out[key] = value;
  }
  return Object.freeze(out) as Readonly<Record<K[number], boolean>>;
}

function snapshotArray(input: unknown, label: string): unknown[] {
  if (!Array.isArray(input)) throw new Error(`${label} must be array`);
  const descriptors = Object.getOwnPropertyDescriptors(input) as Record<string, PropertyDescriptor>;
  const lengthDescriptor = descriptors.length;
  if (!lengthDescriptor || "get" in lengthDescriptor || "set" in lengthDescriptor) {
    throw new Error("unsafe array length");
  }
  const length = lengthDescriptor.value;
  if (!Number.isInteger(length) || length < 0 || length > 5) throw new Error("unsafe array length");
  const allowed = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !allowed.has(key)) throw new Error("unexpected array key");
    const descriptor = descriptors[key];
    if (!descriptor || "get" in descriptor || "set" in descriptor) throw new Error("unsafe array descriptor");
  }
  return Array.from({ length }, (_, index) => {
    const descriptor = descriptors[String(index)];
    if (!descriptor || "get" in descriptor || "set" in descriptor) throw new Error("unsafe array element");
    return descriptor.value;
  });
}

function snapshotObject<const K extends readonly string[]>(input: unknown, label: string, allowedKeys: K): Record<K[number], unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} must be object`);
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("unsafe prototype");
  const descriptors = Object.getOwnPropertyDescriptors(input) as Record<string, PropertyDescriptor>;
  const expected = new Set<string>(allowedKeys as readonly string[]);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== allowedKeys.length) throw new Error("unexpected key count");

  const out = Object.create(null) as Record<K[number], unknown>;
  for (const key of keys) {
    if (typeof key !== "string" || !expected.has(key)) throw new Error("unexpected key");
    const descriptor = descriptors[key];
    if (!descriptor || "get" in descriptor || "set" in descriptor || !descriptor.enumerable) {
      throw new Error("unsafe descriptor");
    }
    out[key as K[number]] = descriptor.value;
  }
  for (const key of allowedKeys) {
    if (!(key in out)) throw new Error("missing key");
  }
  return out;
}

function isRole(input: unknown): input is ControlledCorpusV2Role {
  return typeof input === "string" && (ROLES as string[]).includes(input);
}
