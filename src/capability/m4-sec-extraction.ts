import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";
import type { M4PublicEvidence } from "./public-http-fetch-policy.ts";

export interface M4SecEvidenceExcerpt {
  readonly kind: "m4-sec-literal-evidence-excerpt";
  readonly value: string;
  readonly jsonPointer: "/sicDescription";
  readonly field: "sicDescription";
  readonly context: typeof M4_CANONICAL_TARGET_POLICY.expectedIdentity;
  readonly sourceUrl: typeof M4_CANONICAL_TARGET_POLICY.url;
  readonly responseSha256: string;
  readonly provenance: { readonly publisher: typeof M4_CANONICAL_TARGET_POLICY.publisher; readonly cik: "0001048911" };
  readonly trustLabel: "Quoted/untrusted public-source content";
  readonly verificationStatus: "Unverified";
}

function rejectUnsafeShape(value: unknown, depth = 0): void {
  if (depth > 32) throw new Error("SEC extraction refused");
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return;
  if (Array.isArray(value)) {
    if (utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
        Object.getOwnPropertyNames(value).length !== value.length + 1) throw new Error("SEC extraction refused");
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("SEC extraction refused");
      rejectUnsafeShape(descriptor.value, depth + 1);
    }
    return;
  }
  if (typeof value !== "object" || utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) throw new Error("SEC extraction refused");
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (["__proto__", "prototype", "constructor"].includes(key) || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error("SEC extraction refused");
    }
    rejectUnsafeShape(descriptor.value, depth + 1);
  }
}

function exactStringArray(value: unknown): readonly string[] {
  rejectUnsafeShape(value);
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string")) {
    throw new Error("SEC extraction refused");
  }
  return value;
}

export function extractM4SecEvidence(evidence: M4PublicEvidence): Readonly<M4SecEvidenceExcerpt> {
  if (evidence.requestedUrl !== M4_CANONICAL_TARGET_POLICY.url || evidence.finalUrl !== M4_CANONICAL_TARGET_POLICY.url ||
      evidence.targetPolicySha256 !== M4_TARGET_POLICY_SHA256 || evidence.contentType !== "application/json") {
    throw new Error("SEC extraction refused");
  }
  if (typeof evidence.bodyBase64 !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(evidence.bodyBase64)) {
    throw new Error("SEC extraction refused");
  }
  const bytes = Buffer.from(evidence.bodyBase64, "base64");
  const responseSha256 = createHash("sha256").update(bytes).digest("hex");
  if (bytes.toString("base64") !== evidence.bodyBase64 || bytes.byteLength !== evidence.byteCount ||
      bytes.byteLength > M4_CANONICAL_TARGET_POLICY.network.maxBodyBytes ||
      responseSha256 !== evidence.responseSha256 || evidence.quotedBodyText !== bytes.toString("utf8")) {
    throw new Error("SEC extraction refused");
  }
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("SEC extraction refused"); }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("SEC extraction refused"); }
  rejectUnsafeShape(parsed);
  const root = parsed as Record<string, unknown>;
  const expected = M4_CANONICAL_TARGET_POLICY.expectedIdentity;
  const tickers = exactStringArray(root.tickers);
  const exchanges = exactStringArray(root.exchanges);
  const normalizedCik = typeof root.cik === "number" && Number.isSafeInteger(root.cik) && root.cik >= 0
    ? String(root.cik).padStart(10, "0")
    : typeof root.cik === "string" && /^\d{1,10}$/.test(root.cik) ? root.cik.padStart(10, "0") : null;
  const sicDescription = root.sicDescription;
  const normalizedSicDescription = typeof sicDescription === "string" && /^[\x20-\x7e]+$/.test(sicDescription)
    ? sicDescription.replace(/[a-z]/g, (letter) => letter.toUpperCase()) : null;
  if (normalizedCik !== expected.cik || root.name !== expected.name || root.sic !== expected.sic ||
      normalizedSicDescription !== expected.sicDescription || tickers.length !== exchanges.length ||
      !tickers.some((ticker, index) => ticker === expected.ticker && exchanges[index] === expected.exchange)) {
    throw new Error("SEC extraction refused");
  }
  const literalSourceFieldValue = sicDescription as string;
  return Object.freeze({ kind: "m4-sec-literal-evidence-excerpt", value: literalSourceFieldValue,
    jsonPointer: "/sicDescription", field: "sicDescription", context: expected,
    sourceUrl: M4_CANONICAL_TARGET_POLICY.url, responseSha256: evidence.responseSha256,
    provenance: Object.freeze({ publisher: M4_CANONICAL_TARGET_POLICY.publisher, cik: expected.cik }),
    trustLabel: "Quoted/untrusted public-source content", verificationStatus: "Unverified" });
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderM4SecWorkshopEvidence(excerpt: M4SecEvidenceExcerpt): string {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Atliera Workshop — SEC evidence preview</title><style>` +
    `:root{color-scheme:light;background:#f5f7fb;color:#172033;font:16px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}` +
    `*{box-sizing:border-box}body{margin:0}main{max-width:880px;margin:0 auto;padding:48px 24px 72px}` +
    `h1{margin:0 0 24px;font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#53617a}` +
    `section{background:#fff;border:1px solid #dce2ec;border-radius:16px;box-shadow:0 10px 30px #24355414;padding:32px}` +
    `h2{margin:0 0 14px;font-size:1.75rem}.trust{display:inline-block;border:1px solid #d97706;border-radius:999px;background:#fff7ed;color:#9a3412;padding:5px 10px;font-weight:700}` +
    `blockquote{margin:28px 0;padding:20px 24px;border-left:4px solid #64748b;background:#f8fafc;font:600 1.35rem/1.4 ui-serif,Georgia,serif}` +
    `dl{display:grid;grid-template-columns:180px minmax(0,1fr);gap:10px 20px;margin:0}dt{font-weight:700;color:#53617a}dd{margin:0;overflow-wrap:anywhere}` +
    `.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9rem}.caveat{margin:28px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;color:#53617a}` +
    `@media(max-width:620px){main{padding:24px 12px}section{padding:22px}dl{grid-template-columns:1fr;gap:4px}dd{margin-bottom:10px}}` +
    `</style></head>\n<body><main><h1>Atliera Workshop</h1><section aria-labelledby="m4-sec-evidence"><h2 id="m4-sec-evidence">SEC evidence preview</h2>` +
    `<strong class="trust">Quoted/untrusted public-source content — Unverified</strong><blockquote>${escapeHtml(excerpt.value)}</blockquote>` +
    `<dl><dt>Source field</dt><dd class="mono">${excerpt.jsonPointer}</dd><dt>Source URL</dt><dd class="mono">${escapeHtml(excerpt.sourceUrl)}</dd>` +
    `<dt>CIK</dt><dd class="mono">${excerpt.provenance.cik}</dd><dt>Publisher</dt><dd>${escapeHtml(excerpt.provenance.publisher)}</dd>` +
    `<dt>Response custody SHA-256</dt><dd class="mono">${excerpt.responseSha256}</dd></dl>` +
    `<p class="caveat">Transport success does not verify source claims. No graph ingestion was performed.</p></section></main></body></html>\n`;
}
