// Static portability guardrail.
//
// Runtime infrastructure values must stay in env/config/secret management so
// Atliera can move across hosts, databases, queues, storage backends, and
// provider endpoints without product-code rewrites. This test intentionally
// scans app/source and deploy-oriented files, not deterministic fixtures or
// architecture docs where reserved example domains may appear.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

const SCAN_ROOTS = [
  "src",
  "scripts",
  "deploy",
  "config",
  join(".github", "workflows"),
];

const SCAN_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".sh",
  ".bash",
  ".env",
  ".example",
]);

const INFRA_PATTERNS: { name: string; pattern: RegExp }[] = [
  {
    name: "protocol URL",
    pattern: /https?:\/\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/g,
  },
  {
    name: "database connection URL",
    pattern: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb|redis|sqlite|file):(?:\/\/)?[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/gi,
  },
  {
    name: "database path assignment",
    pattern: /\b(?:DATABASE_URL|DATABASE_PATH|DB_PATH|SQLITE_PATH|SQLITE_FILE)\s*[:=]\s*["']?(?:file:)?(?:\.?\.?\/|\/)[^"'\s]+\.db\b/gi,
  },
  {
    name: "literal IPv4 address",
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  },
  {
    name: "literal IPv6 address",
    pattern: /(?:^|[^A-Za-z0-9_:])(?:[A-Fa-f0-9]{1,4}:){2,}[A-Fa-f0-9:]{1,}(?:%[A-Za-z0-9_.-]+)?(?=$|[^A-Za-z0-9_:])/g,
  },
  {
    name: "hardcoded infrastructure hostname assignment",
    pattern: /\b(?:DATABASE_HOST|DB_HOST|PGHOST|POSTGRES_HOST|MYSQL_HOST|REDIS_HOST|QUEUE_HOST|STORAGE_ENDPOINT|S3_ENDPOINT|MODEL_ENDPOINT|PROVIDER_ENDPOINT|WEBHOOK_URL|CALLBACK_URL)\s*[:=]\s*["']?[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z][A-Za-z0-9-]+\b/gi,
  },
  {
    name: "server-local production path",
    pattern: /(?:^|["'`:=\s])\/(?:var\/lib|var\/log|var\/backups|etc|opt|srv)\/atliera\b/g,
  },
];

function extensionOf(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".env.example")) return ".example";
  const lastDot = lower.lastIndexOf(".");
  return lastDot === -1 ? "" : lower.slice(lastDot);
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(full, out);
      continue;
    }

    if (SCAN_FILE_EXTENSIONS.has(extensionOf(full))) {
      out.push(full);
    }
  }

  return out;
}

function scannedFiles(): string[] {
  return SCAN_ROOTS.flatMap((root) => walk(join(REPO_ROOT, root))).sort();
}

function redactInfrastructureLiteral(value: string): string {
  let redacted = value.replace(
    /([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s/@:]+)(?::([^\s/@]+))?@/g,
    (_match, scheme) => `${scheme}<redacted>@`,
  );

  redacted = redacted.replace(
    /(password|passwd|pwd|token|secret|key)=([^&\s"']+)/gi,
    "$1=<redacted>",
  );

  return redacted;
}

function findInfrastructureLiteralsInText(file: string, text: string): { file: string; kind: string; value: string }[] {
  const hits: { file: string; kind: string; value: string }[] = [];

  for (const { name, pattern } of INFRA_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      hits.push({
        file,
        kind: name,
        value: redactInfrastructureLiteral(match[0].trim()),
      });
      match = pattern.exec(text);
    }
  }

  return hits;
}

function isIntentionalM4AcquisitionPolicyLiteral(hit: {
  file: string;
  kind: string;
  value: string;
}): boolean {
  const acquisitionPolicyFiles = new Set([
    "src/capability/m4-target-policy.ts",
    "src/capability/public-http-fetch-policy.ts",
    "src/capability/m4-public-http-fetch-proof.ts",
  ]);
  const acquisitionLiteralKinds = new Set([
    "protocol URL",
    "literal IPv4 address",
    "literal IPv6 address",
  ]);

  // M4 is the one reviewed source boundary whose product code must contain a
  // ratified public URL, denied address ranges, pinned policy references,
  // and deterministic proof-only addresses/content. These are acquisition
  // policy data, not deploy/runtime infrastructure locations. Every other
  // infrastructure-literal kind remains forbidden even in these three files.
  return acquisitionPolicyFiles.has(hit.file) && acquisitionLiteralKinds.has(hit.kind);
}

function findInfrastructureLiterals(files: string[]): { file: string; kind: string; value: string }[] {
  const hits: { file: string; kind: string; value: string }[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    hits.push(...findInfrastructureLiteralsInText(relative(REPO_ROOT, file), text));
  }

  return hits.filter((hit) => !isIntentionalM4AcquisitionPolicyLiteral(hit));
}

describe("safety: app/deploy files do not hardcode infrastructure locations", () => {
  it("scans source and deployment-oriented roots", () => {
    const files = scannedFiles();
    assert(
      files.some((file) => relative(REPO_ROOT, file).startsWith("src/")),
      "expected portability scan to include src/ files",
    );
  });

  it("detects representative nonportable infrastructure literals without leaking credentials", () => {
    const hits = findInfrastructureLiteralsInText(
      "synthetic.env",
      [
        "APP_BASE_URL=https://prod.example.com",
        "API_HOST=203.0.113.10",
        "IPV6=2001:db8::1",
        "DATABASE_URL=postgres://user:supersecret@db.prod.internal/atliera?password=alsosecret",
        "DATABASE_URL=file:./prod.db",
        "PGHOST=db.prod.internal",
        "ARTIFACT_DIR=/var/lib/atliera/artifacts",
      ].join("\n"),
    );

    assert(hits.some((hit) => hit.kind === "protocol URL"));
    assert(hits.some((hit) => hit.kind === "literal IPv4 address"));
    assert(hits.some((hit) => hit.kind === "literal IPv6 address"));
    assert(hits.some((hit) => hit.kind === "database connection URL"));
    assert(hits.some((hit) => hit.kind === "database path assignment"));
    assert(hits.some((hit) => hit.kind === "hardcoded infrastructure hostname assignment"));
    assert(hits.some((hit) => hit.kind === "server-local production path"));
    assert(!JSON.stringify(hits).includes("supersecret"));
    assert(!JSON.stringify(hits).includes("alsosecret"));
  });

  it("contains no hardcoded URLs, IPs, DB URLs, host assignments, DB paths, or Atliera server-local paths", () => {
    const hits = findInfrastructureLiterals(scannedFiles());
    assert.deepEqual(
      hits,
      [],
      "runtime infrastructure locations must come from env/config, not hardcoded literals: " +
        JSON.stringify(hits, null, 2),
    );
  });
});
