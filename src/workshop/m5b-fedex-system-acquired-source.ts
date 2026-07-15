import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import { extractM4SecEvidence } from "../capability/m4-sec-extraction.ts";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_SHA256 } from "../capability/m4-target-policy.ts";
import type { M4PublicEvidence } from "../capability/public-http-fetch-policy.ts";

export const M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN = "system-acquired-public" as const;
export const M5B_FEDEX_FIXTURE_ORIGIN = "simulated-fixture" as const;
export const M5B_FEDEX_SYSTEM_ACQUIRED_SOURCE_TYPE =
  "system_acquired_sec_submissions_bounded_projection" as const;
export const M5B_FEDEX_FIXTURE_SOURCE_TYPE =
  "simulated_fixture_sec_submissions_bounded_projection" as const;
export const M5B_FEDEX_TRUST_STATUS = "source-backed-not-independently-verified" as const;
export const M5B_FEDEX_REVIEW_STATE = "pending human review" as const;
export const M5B_FEDEX_REQUIRED_IDENTITY_CLAIM =
  "The SEC submissions record identifies FEDEX CORP, CIK 0001048911, with ticker FDX on NYSE." as const;
export const M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM =
  "The SEC classifies the registrant under SIC 4513, “Air Courier Services.”" as const;
export const M5B_FEDEX_RESTRAINED_PLAY =
  "Review the cited filing before the next FedEx account conversation." as const;

export interface M5bFedExProductionPins {
  readonly custodyArtifactSha256: string;
  readonly decodedResponseBytes: number;
  readonly responseSha256: string;
  readonly targetPolicySha256: string;
  readonly capabilityDescriptorSha256: string;
  readonly sourceUrl: string;
  readonly cik: string;
  readonly acquiredAt: string;
  readonly originalCustodyRetentionDeadline: string;
}

export const M5B_FEDEX_PRODUCTION_PINS = Object.freeze({
  custodyArtifactSha256: "c368ea513220a207ef839b30dd527522a6a76304705c88d7243b64bb6f13eb1f",
  decodedResponseBytes: 160901,
  responseSha256: "ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d",
  targetPolicySha256: "a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a",
  capabilityDescriptorSha256: "0abd3c555771006749eaa59604c69e37090d32ea738eeb588dbb36423d1a2fb5",
  sourceUrl: "https://data.sec.gov/submissions/CIK0001048911.json",
  cik: "0001048911",
  acquiredAt: "2026-07-14T18:41:11.214Z",
  originalCustodyRetentionDeadline: "2026-08-13T18:41:11.277Z",
} as const satisfies M5bFedExProductionPins);

export const M5B_FEDEX_DEMO_FIXTURE_NOTICE =
  "synthetic/committed-public pre-effect fixture; exact private source admission not completed" as const;

const SAFE_HASH = /^[a-f0-9]{64}$/;
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CANONICAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
export const M5B_FEDEX_INPUT_LIMITS = Object.freeze({
  objectOwnPropertyCount: 256,
  primitiveLeafAndPropertyCount: 50_000,
  stringUtf8Bytes: 262_144,
  cumulativeCanonicalUtf8Bytes: 2_097_152,
  custodyInputBytes: 1_048_576,
  responseInputBytes: 1_048_576,
  recursionDepth: 32,
  arraySize: 10_000,
  totalNodes: 40_000,
} as const);

export class M5bFedExRefusal extends Error {
  constructor(public readonly code: string) {
    super(`M5b FedEx pre-effect refused: ${code}`);
    this.name = "M5bFedExRefusal";
  }
}

function refuse(code: string): never {
  throw new M5bFedExRefusal(code);
}

interface SnapshotBudget {
  totalNodes: number;
  primitiveLeavesAndProperties: number;
  readonly active: WeakSet<object>;
  readonly rootLabel: string;
}

function accountSnapshotNode(budget: SnapshotBudget, label: string): void {
  budget.totalNodes += 1;
  if (budget.totalNodes > M5B_FEDEX_INPUT_LIMITS.totalNodes) refuse(`${budget.rootLabel}_total_nodes`);
}

function accountPrimitiveOrProperty(budget: SnapshotBudget, label: string): void {
  budget.primitiveLeavesAndProperties += 1;
  if (budget.primitiveLeavesAndProperties > M5B_FEDEX_INPUT_LIMITS.primitiveLeafAndPropertyCount) {
    refuse(`${budget.rootLabel}_primitive_budget`);
  }
}

function validateStringBytes(value: string, label: string): void {
  if (Buffer.byteLength(value, "utf8") > M5B_FEDEX_INPUT_LIMITS.stringUtf8Bytes) refuse(`${label}_string_bytes`);
}

/**
 * Hostile-input snapshot used by every public M5b object boundary. Proxy is
 * checked first; accessor values are never read. Arrays permit only their
 * intrinsic non-enumerable length plus dense enumerable own data elements.
 */
function snapshotM5bFedExOwnDataInternal(value: unknown, label: string, budget: SnapshotBudget,
  depth: number): unknown {
  if (depth > M5B_FEDEX_INPUT_LIMITS.recursionDepth) refuse(`${budget.rootLabel}_recursion_depth`);
  accountSnapshotNode(budget, label);
  if (value === null || typeof value === "boolean") {
    accountPrimitiveOrProperty(budget, label);
    return value;
  }
  if (typeof value === "string") {
    validateStringBytes(value, label);
    accountPrimitiveOrProperty(budget, label);
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    accountPrimitiveOrProperty(budget, label);
    return value;
  }
  if (typeof value !== "object") refuse(`${label}_non_data`);
  if (utilTypes.isProxy(value)) refuse(`${label}_proxy`);
  if (budget.active.has(value)) refuse(`${budget.rootLabel}_cycle`);
  budget.active.add(value);
  try {
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > M5B_FEDEX_INPUT_LIMITS.arraySize ||
        !Number.isSafeInteger(value.length) || value.length < 0 || Object.getOwnPropertySymbols(value).length !== 0) {
      refuse(value.length > M5B_FEDEX_INPUT_LIMITS.arraySize ? `${label}_array_size` : `${label}_array_shape`);
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== value.length + 1 || !names.includes("length")) refuse(`${label}_array_shape`);
    const out: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) refuse(`${label}_array_data`);
      accountPrimitiveOrProperty(budget, label);
      out.push(snapshotM5bFedExOwnDataInternal(descriptor.value, `${label}[${index}]`, budget, depth + 1));
    }
    return Object.freeze(out);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) refuse(`${label}_prototype`);
  const names = Object.getOwnPropertyNames(value);
  if (names.length > M5B_FEDEX_INPUT_LIMITS.objectOwnPropertyCount) refuse(`${label}_own_property_count`);
  if (Object.getOwnPropertySymbols(value).length !== 0) refuse(`${label}_symbols`);
  const out: Record<string, unknown> = {};
  for (const key of names) {
    if (UNSAFE_KEYS.has(key)) refuse(`${label}_unsafe_key`);
    validateStringBytes(key, label);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) refuse(`${label}_own_data`);
    if (descriptor.enumerable !== true || !("value" in descriptor)) refuse(`${label}_own_data`);
    accountPrimitiveOrProperty(budget, label);
    Object.defineProperty(out, key, {
      enumerable: true,
      configurable: false,
      writable: false,
      value: snapshotM5bFedExOwnDataInternal(descriptor.value, `${label}.${key}`, budget, depth + 1),
    });
  }
  return Object.freeze(out);
  } finally {
    budget.active.delete(value);
  }
}

export function snapshotM5bFedExOwnData(value: unknown, label = "input"): unknown {
  return snapshotM5bFedExOwnDataInternal(value, label,
    { totalNodes: 0, primitiveLeavesAndProperties: 0, active: new WeakSet<object>(), rootLabel: label }, 0);
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) refuse(`${label}_object`);
  return value as Readonly<Record<string, unknown>>;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) refuse(`${label}_array`);
  return value;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) refuse(`${label}_envelope`);
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") refuse(`${label}_string`);
  return value;
}

function exactString(value: unknown, expected: string, label: string): void {
  if (value !== expected) refuse(`${label}_drift`);
}

function exactNumber(value: unknown, expected: number, label: string): void {
  if (value !== expected) refuse(`${label}_drift`);
}

function strictIso(value: unknown, label: string): string {
  if (typeof value !== "string" || !STRICT_ISO.test(value) || new Date(value).toISOString() !== value) {
    refuse(`${label}_timestamp`);
  }
  return value;
}

export function canonicalM5bFedExJson(value: unknown): string {
  const snapshot = snapshotM5bFedExOwnData(value, "canonical");
  const chunks: string[] = [];
  let utf8Bytes = 0;
  let totalNodes = 0;
  const active = new WeakSet<object>();
  const emit = (chunk: string): void => {
    utf8Bytes += Buffer.byteLength(chunk, "utf8");
    if (utf8Bytes > M5B_FEDEX_INPUT_LIMITS.cumulativeCanonicalUtf8Bytes) refuse("canonical_utf8_budget");
    chunks.push(chunk);
  };
  const visit = (current: unknown, depth: number): void => {
    if (depth > M5B_FEDEX_INPUT_LIMITS.recursionDepth) refuse("canonical_recursion_depth");
    totalNodes += 1;
    if (totalNodes > M5B_FEDEX_INPUT_LIMITS.totalNodes) refuse("canonical_total_nodes");
    if (current === null || typeof current === "string" || typeof current === "boolean" ||
        (typeof current === "number" && Number.isFinite(current))) {
      emit(JSON.stringify(current));
      return;
    }
    if (typeof current !== "object") refuse("canonical_non_json");
    if (active.has(current)) refuse("canonical_cycle");
    active.add(current);
    try {
      if (Array.isArray(current)) {
        if (current.length > M5B_FEDEX_INPUT_LIMITS.arraySize) refuse("canonical_array_size");
        emit("[");
        for (let index = 0; index < current.length; index += 1) {
          if (index > 0) emit(",");
          visit(current[index], depth + 1);
        }
        emit("]");
        return;
      }
      const object = record(current, "canonical");
      const keys = Object.keys(object).sort();
      if (keys.length > M5B_FEDEX_INPUT_LIMITS.objectOwnPropertyCount) refuse("canonical_own_property_count");
      emit("{");
      for (const [index, key] of keys.entries()) {
        if (index > 0) emit(",");
        emit(JSON.stringify(key));
        emit(":");
        visit(object[key], depth + 1);
      }
      emit("}");
    } finally {
      active.delete(current);
    }
  };
  visit(snapshot, 0);
  return chunks.join("");
}

export function sha256M5bFedExCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalM5bFedExJson(value), "utf8").digest("hex");
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

interface M5bFedExStrictJsonBytes {
  readonly bytes: Buffer;
  readonly text: string;
  readonly value: unknown;
}

function strictJsonBytes(bytesInput: Uint8Array, label: string, maximumBytes: number): M5bFedExStrictJsonBytes {
  if (!(bytesInput instanceof Uint8Array)) refuse(`${label}_bytes`);
  if (bytesInput.byteLength > maximumBytes) refuse(`${label}_input_bytes`);
  const bytes = Buffer.from(bytesInput);
  if (bytes.length === 0 || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) refuse(`${label}_utf8`);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { refuse(`${label}_utf8`); }
  if (!Buffer.from(text, "utf8").equals(bytes)) refuse(`${label}_utf8`);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { refuse(`${label}_json`); }
  return Object.freeze({ bytes, text, value: snapshotM5bFedExOwnData(parsed, label) });
}

export interface M5bFedExLiteralField {
  readonly jsonPointer: "/name" | "/cik" | "/tickers" | "/exchanges" | "/sic" | "/sicDescription" |
    `/filings/recent/form/${number}` | `/filings/recent/filingDate/${number}` |
    `/filings/recent/accessionNumber/${number}` | `/filings/recent/primaryDocument/${number}`;
  readonly literal: string | number | readonly string[];
}

export interface M5bFedExAlignedFiling {
  readonly index: number;
  readonly form: string;
  readonly filingDate: string;
  readonly accessionNumber: string;
  readonly primaryDocument: string;
}

export interface M5bFedExBoundedSource {
  readonly kind: "m5b-fedex-bounded-sec-source";
  readonly origin: typeof M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN | typeof M5B_FEDEX_FIXTURE_ORIGIN;
  readonly sourceType: typeof M5B_FEDEX_SYSTEM_ACQUIRED_SOURCE_TYPE | typeof M5B_FEDEX_FIXTURE_SOURCE_TYPE;
  readonly trustStatus: typeof M5B_FEDEX_TRUST_STATUS;
  readonly name: "FEDEX CORP";
  readonly cikLiteral: string | number;
  readonly cik: "0001048911";
  readonly tickersLiteral: readonly string[];
  readonly exchangesLiteral: readonly string[];
  readonly ticker: "FDX";
  readonly exchange: "NYSE";
  readonly sicLiteral: "4513";
  readonly sic: "4513";
  readonly sicDescriptionLiteral: "Air Courier Services";
  readonly sicDescription: "Air Courier Services";
  readonly filing: M5bFedExAlignedFiling | null;
  readonly filingAlignment: "empty" | "aligned_unique_newest" | "omitted_ambiguous";
  readonly fields: readonly M5bFedExLiteralField[];
  readonly transformations: readonly M5bFedExTransformation[];
  readonly sourceUrl: typeof M5B_FEDEX_PRODUCTION_PINS.sourceUrl;
  readonly acquiredAt: typeof M5B_FEDEX_PRODUCTION_PINS.acquiredAt;
  readonly sourceSha256: string;
  readonly inputSha256: string;
  readonly exactProductionCustodyAdmissionCompleted: boolean;
  readonly fixtureNotice: typeof M5B_FEDEX_DEMO_FIXTURE_NOTICE | null;
}

export interface M5bFedExProductionAdmissionEvidence {
  readonly state: "exact-production-custody-admission-completed";
  readonly custodyArtifactSha256: typeof M5B_FEDEX_PRODUCTION_PINS.custodyArtifactSha256;
  readonly decodedResponseBytes: typeof M5B_FEDEX_PRODUCTION_PINS.decodedResponseBytes;
  readonly responseSha256: typeof M5B_FEDEX_PRODUCTION_PINS.responseSha256;
  readonly targetPolicySha256: typeof M5B_FEDEX_PRODUCTION_PINS.targetPolicySha256;
  readonly capabilityDescriptorSha256: typeof M5B_FEDEX_PRODUCTION_PINS.capabilityDescriptorSha256;
  readonly sourceUrl: typeof M5B_FEDEX_PRODUCTION_PINS.sourceUrl;
  readonly cik: typeof M5B_FEDEX_PRODUCTION_PINS.cik;
  readonly acquiredAt: typeof M5B_FEDEX_PRODUCTION_PINS.acquiredAt;
}

export interface M5bFedExTransformation {
  readonly id: string;
  readonly inputs: readonly string[];
  readonly output: string;
  readonly description: string;
}

function exactStringArray(value: unknown, label: string, allowEmpty: boolean): readonly string[] {
  const values = array(value, label);
  if ((!allowEmpty && values.length === 0) || values.some((item) => typeof item !== "string")) refuse(`${label}_strings`);
  return Object.freeze(values as string[]);
}

function normalizedCik(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value).padStart(10, "0");
  if (typeof value === "string" && /^\d{1,10}$/.test(value)) return value.padStart(10, "0");
  return null;
}

function canonicalDate(value: string): boolean {
  if (!CANONICAL_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function selectFiling(root: Readonly<Record<string, unknown>>):
  { filing: M5bFedExAlignedFiling | null; alignment: M5bFedExBoundedSource["filingAlignment"] } {
  const filingsValue = root.filings;
  if (filingsValue === undefined) return { filing: null, alignment: "omitted_ambiguous" };
  const filings = record(filingsValue, "response.filings");
  const recentValue = filings.recent;
  if (recentValue === undefined) return { filing: null, alignment: "omitted_ambiguous" };
  const recent = record(recentValue, "response.filings.recent");
  const required = ["form", "filingDate", "accessionNumber", "primaryDocument"] as const;
  if (required.some((key) => !(key in recent))) return { filing: null, alignment: "omitted_ambiguous" };
  const values = required.map((key) => {
    try { return exactStringArray(recent[key], `response.filings.recent.${key}`, true); }
    catch { return null; }
  });
  if (values.some((value) => value === null)) return { filing: null, alignment: "omitted_ambiguous" };
  const [forms, dates, accessions, documents] = values as [readonly string[], readonly string[], readonly string[], readonly string[]];
  if (forms.length === 0 && dates.length === 0 && accessions.length === 0 && documents.length === 0) {
    return { filing: null, alignment: "empty" };
  }
  if (![dates.length, accessions.length, documents.length].every((length) => length === forms.length) ||
      dates.some((date) => !canonicalDate(date))) return { filing: null, alignment: "omitted_ambiguous" };
  const newest = [...dates].sort().at(-1)!;
  const indices = dates.map((date, index) => date === newest ? index : -1).filter((index) => index >= 0);
  if (indices.length !== 1) return { filing: null, alignment: "omitted_ambiguous" };
  const index = indices[0]!;
  if (!forms[index] || !/^\d{10}-\d{2}-\d{6}$/.test(accessions[index]!) || !documents[index]) {
    return { filing: null, alignment: "omitted_ambiguous" };
  }
  return { filing: Object.freeze({ index, form: forms[index]!, filingDate: dates[index]!,
    accessionNumber: accessions[index]!, primaryDocument: documents[index]! }), alignment: "aligned_unique_newest" };
}

function cikDisplayTransformation(cik: string): Readonly<M5bFedExTransformation> {
  return Object.freeze({ id: "normalize-cik-to-sec-10-digit-display", inputs: Object.freeze(["/cik"]), output: cik,
    description: "Zero-pad the exact SEC numeric identity to the official 10-digit CIK display; retain the source literal separately." });
}

function tickerExchangeTransformation(index: number): Readonly<M5bFedExTransformation> {
  return Object.freeze({ id: "select-aligned-fdx-nyse-pair", inputs: Object.freeze(["/tickers", "/exchanges"]),
    output: `index ${index}: FDX / NYSE`, description: "Select the exact same-index ticker/exchange pair; do not reorder either source array." });
}

function filingTransformation(filing: M5bFedExAlignedFiling): Readonly<M5bFedExTransformation> {
  return Object.freeze({ id: "select-unique-newest-aligned-filing-row",
    inputs: Object.freeze(["/filings/recent/form", "/filings/recent/filingDate", "/filings/recent/accessionNumber",
      "/filings/recent/primaryDocument"]), output: `index ${filing.index}: ${filing.filingDate}`,
    description: "Require four equal-length arrays, canonical dates, and one unique newest filing date before selecting the same index." });
}

const M5B_FEDEX_EXACT_PRODUCTION_CUSTODY_ADMISSION = Symbol("m5b-fedex-exact-production-custody-admission");
const M5B_FEDEX_COMMITTED_FIXTURE_ADMISSION = Symbol("m5b-fedex-committed-fixture-admission");
type M5bFedExExtractionAdmission = typeof M5B_FEDEX_EXACT_PRODUCTION_CUSTODY_ADMISSION |
  typeof M5B_FEDEX_COMMITTED_FIXTURE_ADMISSION;
const M5B_FEDEX_BOUNDED_SOURCES = new WeakSet<object>();

function exactProductionAdmissionEvidence(): Readonly<M5bFedExProductionAdmissionEvidence> {
  return Object.freeze({
    state: "exact-production-custody-admission-completed",
    custodyArtifactSha256: M5B_FEDEX_PRODUCTION_PINS.custodyArtifactSha256,
    decodedResponseBytes: M5B_FEDEX_PRODUCTION_PINS.decodedResponseBytes,
    responseSha256: M5B_FEDEX_PRODUCTION_PINS.responseSha256,
    targetPolicySha256: M5B_FEDEX_PRODUCTION_PINS.targetPolicySha256,
    capabilityDescriptorSha256: M5B_FEDEX_PRODUCTION_PINS.capabilityDescriptorSha256,
    sourceUrl: M5B_FEDEX_PRODUCTION_PINS.sourceUrl,
    cik: M5B_FEDEX_PRODUCTION_PINS.cik,
    acquiredAt: M5B_FEDEX_PRODUCTION_PINS.acquiredAt,
  });
}

/** Internal bounded projection over bytes that have already passed strict UTF-8/JSON decoding. */
function extractM5bFedExBoundedSourceInternal(decoded: M5bFedExStrictJsonBytes,
  admission: M5bFedExExtractionAdmission): Readonly<M5bFedExBoundedSource> {
  const root = record(decoded.value, "response");
  const name = string(root.name, "response.name");
  const cikLiteral = root.cik;
  const cik = normalizedCik(cikLiteral);
  const tickers = exactStringArray(root.tickers, "response.tickers", false);
  const exchanges = exactStringArray(root.exchanges, "response.exchanges", false);
  const sic = string(root.sic, "response.sic");
  const sicDescription = string(root.sicDescription, "response.sicDescription");
  if (name !== "FEDEX CORP" || cik !== M5B_FEDEX_PRODUCTION_PINS.cik || sic !== "4513" ||
      tickers.length !== exchanges.length || !tickers.some((ticker, index) => ticker === "FDX" && exchanges[index] === "NYSE") ||
      sicDescription !== "Air Courier Services") {
    refuse("bounded_identity");
  }
  const tickerIndex = tickers.findIndex((ticker, index) => ticker === "FDX" && exchanges[index] === "NYSE");
  const selected = selectFiling(root);
  const fields: M5bFedExLiteralField[] = [
    { jsonPointer: "/name", literal: name },
    { jsonPointer: "/cik", literal: cikLiteral as string | number },
    { jsonPointer: "/tickers", literal: tickers },
    { jsonPointer: "/exchanges", literal: exchanges },
    { jsonPointer: "/sic", literal: sic },
    { jsonPointer: "/sicDescription", literal: sicDescription },
  ];
  if (selected.filing) {
    const index = selected.filing.index;
    fields.push(
      { jsonPointer: `/filings/recent/form/${index}`, literal: selected.filing.form },
      { jsonPointer: `/filings/recent/filingDate/${index}`, literal: selected.filing.filingDate },
      { jsonPointer: `/filings/recent/accessionNumber/${index}`, literal: selected.filing.accessionNumber },
      { jsonPointer: `/filings/recent/primaryDocument/${index}`, literal: selected.filing.primaryDocument },
    );
  }
  const transformations: M5bFedExTransformation[] = [cikDisplayTransformation(cik), tickerExchangeTransformation(tickerIndex)];
  if (selected.filing) transformations.push(filingTransformation(selected.filing));
  const exactProductionCustodyAdmissionCompleted = admission === M5B_FEDEX_EXACT_PRODUCTION_CUSTODY_ADMISSION;
  const origin = exactProductionCustodyAdmissionCompleted ? M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN : M5B_FEDEX_FIXTURE_ORIGIN;
  const sourceType = exactProductionCustodyAdmissionCompleted
    ? M5B_FEDEX_SYSTEM_ACQUIRED_SOURCE_TYPE : M5B_FEDEX_FIXTURE_SOURCE_TYPE;
  const bounded = Object.freeze({
    kind: "m5b-fedex-bounded-sec-source", origin, sourceType,
    trustStatus: M5B_FEDEX_TRUST_STATUS, name: "FEDEX CORP", cikLiteral: cikLiteral as string | number,
    cik: "0001048911", tickersLiteral: tickers, exchangesLiteral: exchanges, ticker: "FDX", exchange: "NYSE",
    sicLiteral: "4513", sic: "4513", sicDescriptionLiteral: "Air Courier Services", sicDescription: "Air Courier Services",
    filing: selected.filing, filingAlignment: selected.alignment, fields: Object.freeze(fields),
    transformations: Object.freeze(transformations), sourceUrl: M5B_FEDEX_PRODUCTION_PINS.sourceUrl,
    acquiredAt: M5B_FEDEX_PRODUCTION_PINS.acquiredAt,
    sourceSha256: sha256Bytes(decoded.bytes),
    inputSha256: sha256Bytes(decoded.bytes),
    exactProductionCustodyAdmissionCompleted,
    fixtureNotice: exactProductionCustodyAdmissionCompleted ? null : M5B_FEDEX_DEMO_FIXTURE_NOTICE,
  });
  M5B_FEDEX_BOUNDED_SOURCES.add(bounded);
  return bounded;
}

/** Strict committed-fixture extraction. It can never assert exact production custody admission. */
export function extractM5bFedExCommittedFixtureSource(responseBytes: Uint8Array): Readonly<M5bFedExBoundedSource> {
  const decoded = strictJsonBytes(responseBytes, "response", M5B_FEDEX_INPUT_LIMITS.responseInputBytes);
  return extractM5bFedExBoundedSourceInternal(decoded, M5B_FEDEX_COMMITTED_FIXTURE_ADMISSION);
}

function validatePins(pins: M5bFedExProductionPins): void {
  for (const [key, value] of Object.entries(pins)) {
    if (key.toLowerCase().includes("sha256") && (typeof value !== "string" || !SAFE_HASH.test(value))) refuse(`pins_${key}`);
  }
  if (!Number.isSafeInteger(pins.decodedResponseBytes) || pins.decodedResponseBytes <= 0 ||
      pins.targetPolicySha256 !== M4_TARGET_POLICY_SHA256 || pins.sourceUrl !== M4_CANONICAL_TARGET_POLICY.url ||
      pins.cik !== M4_CANONICAL_TARGET_POLICY.expectedIdentity.cik) refuse("pins_m4_drift");
  const acquired = strictIso(pins.acquiredAt, "pins_acquired");
  const retention = strictIso(pins.originalCustodyRetentionDeadline, "pins_retention");
  if (retention <= acquired) refuse("pins_retention_order");
}

function validateCustodyEnvelope(snapshot: unknown, pins: M5bFedExProductionPins): Readonly<Record<string, unknown>> {
  const root = record(snapshot, "custody");
  exactKeys(root, ["kind", "activation", "targetPolicySha256", "acquiredAt", "acquisition", "extraction",
    "capabilityExecutions", "auditEvents", "accountingIncrements"], "custody");
  exactString(root.kind, "m4-sec-gate-b-custody", "custody_kind");
  exactString(root.targetPolicySha256, pins.targetPolicySha256, "custody_target_policy");
  exactString(root.acquiredAt, pins.acquiredAt, "custody_acquired_at");

  const activation = record(root.activation, "custody.activation");
  exactKeys(activation, ["authorizationId", "oneShotConsumptionId", "reviewedAdapterCommit", "authorizedAt", "validFrom",
    "validUntil", "consumedAt", "consumptionSha256", "userAgentSha256", "userAgentByteLength"], "custody_activation");
  for (const key of ["authorizationId", "oneShotConsumptionId", "reviewedAdapterCommit"] as const) {
    if (!string(activation[key], `activation.${key}`)) refuse(`activation_${key}`);
  }
  for (const key of ["authorizedAt", "validFrom", "validUntil", "consumedAt"] as const) strictIso(activation[key], `activation.${key}`);
  for (const key of ["consumptionSha256", "userAgentSha256"] as const) {
    if (!SAFE_HASH.test(string(activation[key], `activation.${key}`))) refuse(`activation_${key}`);
  }
  if (!Number.isSafeInteger(activation.userAgentByteLength) || (activation.userAgentByteLength as number) <= 0) {
    refuse("activation_user_agent_length");
  }

  const acquisition = record(root.acquisition, "custody.acquisition");
  exactKeys(acquisition, ["requestedTargetRef", "requestedUrl", "finalUrl", "sourceHost", "publisher", "targetPolicySha256",
    "fetchedAt", "httpStatus", "contentType", "byteCount", "responseSha256", "bodyBase64", "quotedBodyText", "trust",
    "provenance", "custody"], "custody_acquisition");
  exactString(acquisition.requestedTargetRef, "sec_fedex_submissions", "acquisition_target");
  exactString(acquisition.requestedUrl, pins.sourceUrl, "acquisition_requested_url");
  exactString(acquisition.finalUrl, pins.sourceUrl, "acquisition_final_url");
  exactString(acquisition.sourceHost, "data.sec.gov", "acquisition_host");
  exactString(acquisition.publisher, M4_CANONICAL_TARGET_POLICY.publisher, "acquisition_publisher");
  exactString(acquisition.targetPolicySha256, pins.targetPolicySha256, "acquisition_target_policy");
  exactString(acquisition.fetchedAt, pins.acquiredAt, "acquisition_timestamp");
  exactNumber(acquisition.httpStatus, 200, "acquisition_status");
  exactString(acquisition.contentType, "application/json", "acquisition_content_type");
  exactNumber(acquisition.byteCount, pins.decodedResponseBytes, "acquisition_byte_count");
  exactString(acquisition.responseSha256, pins.responseSha256, "acquisition_response_hash");

  const trust = record(acquisition.trust, "acquisition.trust");
  exactKeys(trust, ["status", "mayProvideInstructions", "controlAuthority", "transportSuccessPromotesTrust"], "acquisition_trust");
  exactString(trust.status, "quoted_untrusted_public_source_content", "acquisition_trust_status");
  if (trust.mayProvideInstructions !== false || trust.controlAuthority !== "none" || trust.transportSuccessPromotesTrust !== false) {
    refuse("acquisition_trust_drift");
  }
  const provenance = record(acquisition.provenance, "acquisition.provenance");
  exactKeys(provenance, ["acquisitionCapability", "transport", "targetPolicyRef", "targetPolicySha256", "resolvedAddresses",
    "connectedAddress"], "acquisition_provenance");
  exactString(provenance.acquisitionCapability, "public_http_fetch_v1", "acquisition_capability");
  exactString(provenance.transport, "live_sec_one_shot", "acquisition_transport");
  exactString(provenance.targetPolicySha256, pins.targetPolicySha256, "provenance_target_policy");
  const acquisitionCustody = record(acquisition.custody, "acquisition.custody");
  exactKeys(acquisitionCustody, ["exactBytesPreserved", "exactBytesEncoding", "hashAlgorithm", "classification"],
    "acquisition_custody");
  if (acquisitionCustody.exactBytesPreserved !== true || acquisitionCustody.exactBytesEncoding !== "base64" ||
      acquisitionCustody.hashAlgorithm !== "sha256" || acquisitionCustody.classification !== "public_evidence") {
    refuse("acquisition_custody_drift");
  }

  const executions = array(root.capabilityExecutions, "custody.capabilityExecutions");
  if (executions.length !== 1) refuse("execution_count");
  const execution = record(executions[0], "custody.capabilityExecutions[0]");
  exactKeys(execution, ["kind", "executionId", "capabilityId", "descriptorSha256", "targetPolicySha256", "authorityKind",
    "authorityRef", "mediationLevel", "targetRef", "inputBytes", "outputBytes", "retryCount", "startedAt", "completedAt",
    "durationMs", "outcome", "refusalCode", "effectTelemetry"], "execution");
  exactString(execution.kind, "CapabilityExecution", "execution_kind");
  exactString(execution.capabilityId, "public_http_fetch_v1", "execution_capability");
  exactString(execution.descriptorSha256, pins.capabilityDescriptorSha256, "execution_descriptor");
  exactString(execution.targetPolicySha256, pins.targetPolicySha256, "execution_target_policy");
  exactString(execution.authorityKind, "external_gate_b_one_shot_go", "execution_authority");
  exactString(execution.mediationLevel, "L0", "execution_mediation");
  exactString(execution.targetRef, "sec_fedex_submissions", "execution_target");
  exactNumber(execution.outputBytes, pins.decodedResponseBytes, "execution_output_bytes");
  exactNumber(execution.retryCount, 0, "execution_retry");
  exactString(execution.outcome, "completed", "execution_outcome");
  if (execution.refusalCode !== null) refuse("execution_refusal");
  const effectTelemetry = record(execution.effectTelemetry, "execution.effectTelemetry");
  exactKeys(effectTelemetry, ["dnsAttempts", "requestAttempts", "connectionAttempts", "liveNetworkEgress", "bytesReceived",
    "selectedAddress", "lookupCallbacks", "retryCount", "responseSha256", "failurePhase", "userAgentAudit"], "effect_telemetry");
  exactNumber(effectTelemetry.bytesReceived, pins.decodedResponseBytes, "effect_bytes");
  exactNumber(effectTelemetry.retryCount, 0, "effect_retry");
  exactString(effectTelemetry.responseSha256, pins.responseSha256, "effect_response_hash");
  if (effectTelemetry.failurePhase !== null) refuse("effect_failure");

  if (array(root.auditEvents, "custody.auditEvents").length !== 1 ||
      array(root.accountingIncrements, "custody.accountingIncrements").length !== 1) refuse("custody_record_count");
  const accounting = record(array(root.accountingIncrements, "custody.accountingIncrements")[0], "accounting");
  exactKeys(accounting, ["kind", "incrementId", "executionId", "capabilityInvocations", "capabilityExecutionRecords",
    "auditEventsEmitted", "liveNetworkEgressPerformed", "dnsAttemptsPerformed", "requestAttemptsPerformed",
    "connectionAttemptsPerformed", "lookupCallbacksPerformed", "bytesReceived", "selectedAddress", "failurePhase",
    "systemSideAcquisitionProofsPerformed", "retriesPerformed", "providerCallsExecuted", "privateReadsPerformed",
    "graphWritesPerformed", "productionWritesPerformed", "deploymentsPerformed"], "accounting");
  for (const key of ["retriesPerformed", "providerCallsExecuted", "privateReadsPerformed", "graphWritesPerformed",
    "productionWritesPerformed", "deploymentsPerformed"] as const) exactNumber(accounting[key], 0, `accounting_${key}`);
  exactNumber(accounting.bytesReceived, pins.decodedResponseBytes, "accounting_bytes");

  const extraction = record(root.extraction, "custody.extraction");
  exactKeys(extraction, ["kind", "value", "jsonPointer", "field", "context", "sourceUrl", "responseSha256", "provenance",
    "trustLabel", "verificationStatus"], "custody_extraction");
  exactString(extraction.sourceUrl, pins.sourceUrl, "extraction_url");
  exactString(extraction.responseSha256, pins.responseSha256, "extraction_response_hash");
  exactString(extraction.jsonPointer, "/sicDescription", "extraction_pointer");
  return acquisition;
}

/**
 * Pure byte admission against supplied exact pins. The public production
 * wrapper below is the only API that binds the real M4 custody identities;
 * this function exists so byte/envelope validation can be exercised with
 * synthetic custody in tests without reading private custody.
 */
export function validateM5bFedExCustodyBytesAgainstPins(custodyBytes: Uint8Array,
  pinsInput: M5bFedExProductionPins): Readonly<M5bFedExBoundedSource> {
  const pins = snapshotM5bFedExOwnData(pinsInput, "pins") as M5bFedExProductionPins;
  validatePins(pins);
  if (!(custodyBytes instanceof Uint8Array)) refuse("custody_bytes");
  if (custodyBytes.byteLength > M5B_FEDEX_INPUT_LIMITS.custodyInputBytes) refuse("custody_input_bytes");
  const copied = Buffer.from(custodyBytes);
  // The outer custody digest is deliberately checked before UTF-8 decode,
  // JSON parse, envelope inspection, base64 decode, or response hashing.
  if (sha256Bytes(copied) !== pins.custodyArtifactSha256) refuse("custody_sha256");
  const decoded = strictJsonBytes(copied, "custody", M5B_FEDEX_INPUT_LIMITS.custodyInputBytes);
  const acquisition = validateCustodyEnvelope(decoded.value, pins);
  const bodyBase64 = string(acquisition.bodyBase64, "acquisition.bodyBase64");
  const maximumBase64Bytes = 4 * Math.ceil(pins.decodedResponseBytes / 3);
  if (Buffer.byteLength(bodyBase64, "utf8") > maximumBase64Bytes) refuse("response_base64_bounds");
  // Reuse the shipped M4 acquisition/SEC identity validator unchanged.
  extractM4SecEvidence(acquisition as unknown as M4PublicEvidence);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bodyBase64)) refuse("response_base64");
  const responseBytes = Buffer.from(bodyBase64, "base64");
  if (responseBytes.toString("base64") !== bodyBase64 || responseBytes.byteLength !== pins.decodedResponseBytes ||
      sha256Bytes(responseBytes) !== pins.responseSha256) {
    refuse("response_custody");
  }
  const decodedResponse = strictJsonBytes(responseBytes, "response", M5B_FEDEX_INPUT_LIMITS.responseInputBytes);
  if (acquisition.quotedBodyText !== decodedResponse.text) refuse("response_custody");
  const admission = canonicalM5bFedExJson(pins) === canonicalM5bFedExJson(M5B_FEDEX_PRODUCTION_PINS)
    ? M5B_FEDEX_EXACT_PRODUCTION_CUSTODY_ADMISSION
    : M5B_FEDEX_COMMITTED_FIXTURE_ADMISSION;
  return extractM5bFedExBoundedSourceInternal(decodedResponse, admission);
}

/** Exact future production wrapper: caller supplies bytes, never a path. */
export function admitM5bFedExProductionCustodyBytes(custodyBytes: Uint8Array): Readonly<M5bFedExBoundedSource> {
  return validateM5bFedExCustodyBytesAgainstPins(custodyBytes, M5B_FEDEX_PRODUCTION_PINS);
}

export interface M5bFedExSanitizedSourcePackContent {
  readonly kind: "m5b-fedex-sanitized-source-pack";
  readonly schemaVersion: "2";
  readonly fixtureClassification: typeof M5B_FEDEX_DEMO_FIXTURE_NOTICE | "exact-production-custody-admitted";
  readonly exactProductionCustodyAdmissionCompleted: boolean;
  readonly productionAdmissionEvidence: Readonly<M5bFedExProductionAdmissionEvidence> | null;
  readonly origin: M5bFedExBoundedSource["origin"];
  readonly trustStatus: typeof M5B_FEDEX_TRUST_STATUS;
  readonly source: {
    readonly url: typeof M5B_FEDEX_PRODUCTION_PINS.sourceUrl;
    readonly acquiredAt: typeof M5B_FEDEX_PRODUCTION_PINS.acquiredAt;
    readonly sourceType: M5bFedExBoundedSource["sourceType"];
    readonly sourceSha256: string;
    readonly originalCustodyRetentionDeadline: typeof M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline;
  };
  readonly fields: readonly M5bFedExLiteralField[];
  readonly selectedIdentity: { readonly name: "FEDEX CORP"; readonly cik: "0001048911"; readonly ticker: "FDX";
    readonly exchange: "NYSE"; readonly sic: "4513"; readonly sicDescription: string };
  readonly filing: M5bFedExAlignedFiling | null;
  readonly filingAlignment: M5bFedExBoundedSource["filingAlignment"];
  readonly transformations: readonly M5bFedExTransformation[];
  readonly fixtureInputSha256: string | null;
  readonly exclusions: { readonly rawResponseOmitted: true; readonly encodedResponseOmitted: true;
    readonly privatePathOmitted: true; readonly contactOmitted: true; readonly resolvedIpOmitted: true;
    readonly credentialsOmitted: true };
}

export interface M5bFedExSanitizedSourcePack extends M5bFedExSanitizedSourcePackContent {
  readonly sourcePackSha256: string;
}

function sourcePackContent(sourceInput: M5bFedExBoundedSource): Readonly<M5bFedExSanitizedSourcePackContent> {
  const source = snapshotM5bFedExOwnData(sourceInput, "boundedSource") as M5bFedExBoundedSource;
  const expectedOrigin = source.exactProductionCustodyAdmissionCompleted
    ? M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN : M5B_FEDEX_FIXTURE_ORIGIN;
  const expectedSourceType = source.exactProductionCustodyAdmissionCompleted
    ? M5B_FEDEX_SYSTEM_ACQUIRED_SOURCE_TYPE : M5B_FEDEX_FIXTURE_SOURCE_TYPE;
  if (source.kind !== "m5b-fedex-bounded-sec-source" || source.origin !== expectedOrigin ||
      source.sourceType !== expectedSourceType ||
      source.trustStatus !== M5B_FEDEX_TRUST_STATUS || source.sourceUrl !== M5B_FEDEX_PRODUCTION_PINS.sourceUrl ||
      !SAFE_HASH.test(source.sourceSha256) || source.name !== "FEDEX CORP" ||
      source.cik !== "0001048911" || source.ticker !== "FDX" || source.exchange !== "NYSE" || source.sic !== "4513") {
    refuse("bounded_source_counterfeit");
  }
  if (source.exactProductionCustodyAdmissionCompleted && source.sourceSha256 !== M5B_FEDEX_PRODUCTION_PINS.responseSha256) {
    refuse("bounded_source_production_hash");
  }
  if (source.fields.length > 10) refuse("source_pack_field_ceiling");
  return Object.freeze({
    kind: "m5b-fedex-sanitized-source-pack", schemaVersion: "2",
    fixtureClassification: source.exactProductionCustodyAdmissionCompleted ? "exact-production-custody-admitted" : M5B_FEDEX_DEMO_FIXTURE_NOTICE,
    exactProductionCustodyAdmissionCompleted: source.exactProductionCustodyAdmissionCompleted,
    productionAdmissionEvidence: source.exactProductionCustodyAdmissionCompleted ? exactProductionAdmissionEvidence() : null,
    origin: source.origin, trustStatus: M5B_FEDEX_TRUST_STATUS,
    source: Object.freeze({ url: M5B_FEDEX_PRODUCTION_PINS.sourceUrl, acquiredAt: M5B_FEDEX_PRODUCTION_PINS.acquiredAt,
      sourceType: source.sourceType, sourceSha256: source.sourceSha256,
      originalCustodyRetentionDeadline: M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline }),
    fields: source.fields,
    selectedIdentity: Object.freeze({ name: "FEDEX CORP", cik: "0001048911", ticker: "FDX", exchange: "NYSE",
      sic: "4513", sicDescription: source.sicDescription }),
    filing: source.filing, filingAlignment: source.filingAlignment, transformations: source.transformations,
    fixtureInputSha256: source.exactProductionCustodyAdmissionCompleted ? null : source.inputSha256,
    exclusions: Object.freeze({ rawResponseOmitted: true, encodedResponseOmitted: true, privatePathOmitted: true,
      contactOmitted: true, resolvedIpOmitted: true, credentialsOmitted: true }),
  });
}

export function buildM5bFedExSanitizedSourcePack(source: M5bFedExBoundedSource): Readonly<M5bFedExSanitizedSourcePack> {
  if (source === null || typeof source !== "object" || !M5B_FEDEX_BOUNDED_SOURCES.has(source)) {
    refuse("bounded_source_unadmitted");
  }
  const content = sourcePackContent(source);
  return Object.freeze({ ...content, sourcePackSha256: sha256M5bFedExCanonical(content) });
}

function validateProductionAdmissionEvidence(pack: M5bFedExSanitizedSourcePack): void {
  if (!pack.exactProductionCustodyAdmissionCompleted) {
    if (pack.productionAdmissionEvidence !== null || pack.fixtureClassification !== M5B_FEDEX_DEMO_FIXTURE_NOTICE ||
        typeof pack.fixtureInputSha256 !== "string" || !SAFE_HASH.test(pack.fixtureInputSha256)) {
      refuse("source_pack_admission_evidence");
    }
    return;
  }
  if (pack.productionAdmissionEvidence === null || pack.fixtureClassification !== "exact-production-custody-admitted" ||
      pack.fixtureInputSha256 !== null) refuse("source_pack_admission_evidence");
  const evidence = record(pack.productionAdmissionEvidence, "sourcePack.productionAdmissionEvidence");
  exactKeys(evidence, ["state", "custodyArtifactSha256", "decodedResponseBytes", "responseSha256",
    "targetPolicySha256", "capabilityDescriptorSha256", "sourceUrl", "cik", "acquiredAt"],
  "source_pack_admission_evidence");
  if (canonicalM5bFedExJson(evidence) !== canonicalM5bFedExJson(exactProductionAdmissionEvidence())) {
    refuse("source_pack_admission_evidence");
  }
}

function validateSourcePackSemantics(pack: M5bFedExSanitizedSourcePack): void {
  exactKeys(record(pack.source, "sourcePack.source"), ["url", "acquiredAt", "sourceType", "sourceSha256",
    "originalCustodyRetentionDeadline"], "source_pack_source");
  exactKeys(record(pack.selectedIdentity, "sourcePack.selectedIdentity"), ["name", "cik", "ticker", "exchange", "sic",
    "sicDescription"], "source_pack_identity");
  exactKeys(record(pack.exclusions, "sourcePack.exclusions"), ["rawResponseOmitted", "encodedResponseOmitted",
    "privatePathOmitted", "contactOmitted", "resolvedIpOmitted", "credentialsOmitted"], "source_pack_exclusions");

  validateProductionAdmissionEvidence(pack);
  const expectedOrigin = pack.exactProductionCustodyAdmissionCompleted
    ? M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN : M5B_FEDEX_FIXTURE_ORIGIN;
  const expectedSourceType = pack.exactProductionCustodyAdmissionCompleted
    ? M5B_FEDEX_SYSTEM_ACQUIRED_SOURCE_TYPE : M5B_FEDEX_FIXTURE_SOURCE_TYPE;
  const expectedSourceSha256 = pack.exactProductionCustodyAdmissionCompleted
    ? M5B_FEDEX_PRODUCTION_PINS.responseSha256 : pack.fixtureInputSha256;
  if (pack.origin !== expectedOrigin || pack.source.sourceType !== expectedSourceType ||
      pack.source.sourceSha256 !== expectedSourceSha256 || !SAFE_HASH.test(pack.source.sourceSha256)) {
    refuse("source_pack_origin_semantics");
  }

  const fields = array(pack.fields, "sourcePack.fields");
  const basePointers = ["/name", "/cik", "/tickers", "/exchanges", "/sic", "/sicDescription"] as const;
  const fieldRecords = fields.map((field, index) => {
    const item = record(field, `sourcePack.fields[${index}]`);
    exactKeys(item, ["jsonPointer", "literal"], `source_pack_field_${index}`);
    return item;
  });
  const literalAt = (pointer: string): unknown => {
    const matches = fieldRecords.filter((field) => field.jsonPointer === pointer);
    if (matches.length !== 1) refuse("source_pack_field_pointer");
    return matches[0]!.literal;
  };
  const cik = normalizedCik(literalAt("/cik"));
  const tickers = exactStringArray(literalAt("/tickers"), "sourcePack.tickers", false);
  const exchanges = exactStringArray(literalAt("/exchanges"), "sourcePack.exchanges", false);
  const tickerIndex = tickers.findIndex((ticker, index) => ticker === "FDX" && exchanges[index] === "NYSE");
  if (literalAt("/name") !== "FEDEX CORP" || cik !== "0001048911" || tickers.length !== exchanges.length ||
      tickerIndex < 0 || literalAt("/sic") !== "4513" || literalAt("/sicDescription") !== "Air Courier Services" ||
      pack.selectedIdentity.name !== "FEDEX CORP" || pack.selectedIdentity.cik !== "0001048911" ||
      pack.selectedIdentity.ticker !== "FDX" || pack.selectedIdentity.exchange !== "NYSE" ||
      pack.selectedIdentity.sic !== "4513" || pack.selectedIdentity.sicDescription !== "Air Courier Services") {
    refuse("source_pack_identity_semantics");
  }

  let expectedPointers: readonly string[] = basePointers;
  const expectedTransformations: readonly M5bFedExTransformation[] = pack.filing === null
    ? [cikDisplayTransformation(cik), tickerExchangeTransformation(tickerIndex)]
    : (() => {
        const filingRecord = record(pack.filing, "sourcePack.filing");
        exactKeys(filingRecord, ["index", "form", "filingDate", "accessionNumber", "primaryDocument"], "source_pack_filing");
        const filing = pack.filing!;
        if (!Number.isSafeInteger(filing.index) || filing.index < 0 || !filing.form || !canonicalDate(filing.filingDate) ||
            !/^\d{10}-\d{2}-\d{6}$/.test(filing.accessionNumber) || !filing.primaryDocument ||
            pack.filingAlignment !== "aligned_unique_newest") refuse("source_pack_filing_semantics");
        const filingPointers = [`/filings/recent/form/${filing.index}`, `/filings/recent/filingDate/${filing.index}`,
          `/filings/recent/accessionNumber/${filing.index}`, `/filings/recent/primaryDocument/${filing.index}`] as const;
        const filingLiterals = [filing.form, filing.filingDate, filing.accessionNumber, filing.primaryDocument];
        if (filingPointers.some((pointer, index) => literalAt(pointer) !== filingLiterals[index])) {
          refuse("source_pack_filing_literals");
        }
        expectedPointers = [...basePointers, ...filingPointers];
        return [cikDisplayTransformation(cik), tickerExchangeTransformation(tickerIndex), filingTransformation(filing)];
      })();
  if (pack.filing === null && pack.filingAlignment !== "empty" && pack.filingAlignment !== "omitted_ambiguous") {
    refuse("source_pack_filing_alignment");
  }
  if (canonicalM5bFedExJson(fieldRecords.map((field) => field.jsonPointer)) !== canonicalM5bFedExJson(expectedPointers) ||
      canonicalM5bFedExJson(pack.transformations) !== canonicalM5bFedExJson(expectedTransformations)) {
    refuse("source_pack_projection_semantics");
  }
}

export function verifyM5bFedExSanitizedSourcePack(packInput: unknown): Readonly<M5bFedExSanitizedSourcePack> {
  const pack = record(snapshotM5bFedExOwnData(packInput, "sourcePack"), "sourcePack") as unknown as M5bFedExSanitizedSourcePack;
  exactKeys(pack as unknown as Readonly<Record<string, unknown>>, ["kind", "schemaVersion", "fixtureClassification", "exactProductionCustodyAdmissionCompleted", "productionAdmissionEvidence", "origin",
    "trustStatus", "source", "fields", "selectedIdentity", "filing", "filingAlignment", "transformations",
    "fixtureInputSha256", "exclusions", "sourcePackSha256"], "source_pack");
  if (!SAFE_HASH.test(pack.sourcePackSha256)) refuse("source_pack_hash_shape");
  const { sourcePackSha256, ...content } = pack;
  if (sha256M5bFedExCanonical(content) !== sourcePackSha256) refuse("source_pack_hash");
  if (pack.kind !== "m5b-fedex-sanitized-source-pack" || pack.schemaVersion !== "2" ||
      pack.trustStatus !== M5B_FEDEX_TRUST_STATUS ||
      pack.source.url !== M5B_FEDEX_PRODUCTION_PINS.sourceUrl ||
      pack.source.acquiredAt !== M5B_FEDEX_PRODUCTION_PINS.acquiredAt ||
      pack.source.originalCustodyRetentionDeadline !== M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline ||
      pack.selectedIdentity.name !== "FEDEX CORP" || pack.selectedIdentity.cik !== "0001048911" ||
      pack.selectedIdentity.ticker !== "FDX" || pack.selectedIdentity.exchange !== "NYSE" || pack.selectedIdentity.sic !== "4513" ||
      Object.values(pack.exclusions).some((value) => value !== true)) refuse("source_pack_boundary");
  validateSourcePackSemantics(pack);
  if (canonicalM5bFedExJson(pack).includes("bodyBase64") || canonicalM5bFedExJson(pack).includes("quotedBodyText")) {
    refuse("source_pack_raw_content");
  }
  return Object.freeze(pack);
}

export interface M5bFedExModelProposalRequest {
  readonly kind: "m5b-fedex-optional-model-proposal-request";
  readonly sourcePackSha256: string;
  readonly input: "exact-sanitized-source-pack";
  readonly sanitizedSourcePack: Readonly<M5bFedExSanitizedSourcePack>;
  readonly allowedExcerptIds: readonly string[];
  readonly allowedSignalText: string | null;
  readonly allowedPlayText: typeof M5B_FEDEX_RESTRAINED_PLAY | null;
  readonly transport: "model-only";
  readonly tools: false;
  readonly shell: false;
  readonly files: false;
  readonly web: false;
  readonly mcp: false;
  readonly retrieval: false;
  readonly plugins: false;
  readonly sessionCarryover: false;
  readonly maxFutureCalls: 1;
  readonly retries: 0;
  readonly provider: null;
  readonly model: null;
  readonly authorizesProviderCall: false;
  readonly callsPerformed: 0;
}

export interface M5bFedExOptionalModelItem {
  readonly text: string;
  readonly citedExcerptIds: readonly string[];
  readonly provenanceStatus: "unverified";
}

export interface M5bFedExOptionalModelOutput {
  readonly signal: M5bFedExOptionalModelItem | null;
  readonly play: M5bFedExOptionalModelItem | null;
}

export function buildM5bFedExOptionalModelRequest(packInput: unknown,
  excerptIdsInput: readonly string[]): Readonly<M5bFedExModelProposalRequest> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  const excerptIds = array(snapshotM5bFedExOwnData(excerptIdsInput, "excerptIds"), "excerptIds");
  const expectedExcerptIds = ["exc_fedex_registrant_identity", "exc_fedex_industry_classification",
    ...(pack.filing ? ["exc_fedex_latest_filing_metadata"] : [])];
  if (canonicalM5bFedExJson(excerptIds) !== canonicalM5bFedExJson(expectedExcerptIds)) {
    refuse("model_excerpt_ids");
  }
  const filingClaim = pack.filing ? `The SEC submissions metadata lists ${pack.filing.form}, filed ${pack.filing.filingDate}, accession ${pack.filing.accessionNumber}, primary document ${pack.filing.primaryDocument}.` : null;
  return Object.freeze({ kind: "m5b-fedex-optional-model-proposal-request", sourcePackSha256: pack.sourcePackSha256,
    input: "exact-sanitized-source-pack", sanitizedSourcePack: pack,
    allowedExcerptIds: Object.freeze(excerptIds as string[]), allowedSignalText: filingClaim,
    allowedPlayText: pack.filing ? M5B_FEDEX_RESTRAINED_PLAY : null, transport: "model-only", tools: false, shell: false,
    files: false, web: false, mcp: false, retrieval: false, plugins: false, sessionCarryover: false, maxFutureCalls: 1,
    retries: 0, provider: null, model: null, authorizesProviderCall: false, callsPerformed: 0 });
}

export function validateM5bFedExOptionalModelOutput(requestInput: unknown,
  outputInput: unknown, packInput: unknown): Readonly<M5bFedExOptionalModelOutput> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  const request = record(snapshotM5bFedExOwnData(requestInput, "modelRequest"), "modelRequest") as unknown as M5bFedExModelProposalRequest;
  exactKeys(request as unknown as Readonly<Record<string, unknown>>, ["kind", "sourcePackSha256", "input",
    "sanitizedSourcePack", "allowedExcerptIds", "allowedSignalText", "allowedPlayText", "transport", "tools", "shell", "files", "web", "mcp",
    "retrieval", "plugins", "sessionCarryover", "maxFutureCalls", "retries", "provider", "model",
    "authorizesProviderCall", "callsPerformed"], "model_request");
  if (request.kind !== "m5b-fedex-optional-model-proposal-request" || request.transport !== "model-only" ||
      request.sourcePackSha256 !== pack.sourcePackSha256 || request.input !== "exact-sanitized-source-pack" ||
      request.maxFutureCalls !== 1 || request.retries !== 0 || request.provider !== null || request.model !== null ||
      request.authorizesProviderCall !== false || request.callsPerformed !== 0 ||
      [request.tools, request.shell, request.files, request.web, request.mcp, request.retrieval, request.plugins,
        request.sessionCarryover].some((value) => value !== false)) refuse("model_request_open");
  const requestPack = verifyM5bFedExSanitizedSourcePack(request.sanitizedSourcePack);
  if (requestPack.sourcePackSha256 !== request.sourcePackSha256 ||
      canonicalM5bFedExJson(requestPack) !== canonicalM5bFedExJson(pack)) refuse("model_request_source_pack");
  const expectedRequest = buildM5bFedExOptionalModelRequest(pack, request.allowedExcerptIds);
  if (canonicalM5bFedExJson(request) !== canonicalM5bFedExJson(expectedRequest)) refuse("model_request_counterfeit");
  const output = record(snapshotM5bFedExOwnData(outputInput, "modelOutput"), "modelOutput");
  exactKeys(output, ["signal", "play"], "model_output");
  if (output.signal !== null && output.play !== null) refuse("model_both_items");
  if (output.signal === null && output.play === null) return Object.freeze({ signal: null, play: null });
  const kind = output.signal !== null ? "signal" : "play";
  const item = record(output[kind], `modelOutput.${kind}`);
  exactKeys(item, ["text", "citedExcerptIds", "provenanceStatus"], `model_${kind}`);
  const expectedText = kind === "signal" ? request.allowedSignalText : request.allowedPlayText;
  if (expectedText === null || item.text !== expectedText || item.provenanceStatus !== "unverified") refuse("model_item_content");
  const cited = array(item.citedExcerptIds, `modelOutput.${kind}.citedExcerptIds`);
  if (canonicalM5bFedExJson(cited) !== canonicalM5bFedExJson(["exc_fedex_latest_filing_metadata"])) {
    refuse("model_filing_citation_exact");
  }
  const result = Object.freeze({ text: expectedText, citedExcerptIds: Object.freeze(cited as string[]),
    provenanceStatus: "unverified" as const });
  return kind === "signal" ? Object.freeze({ signal: result, play: null }) : Object.freeze({ signal: null, play: result });
}
