import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

const DEMO_FIXTURE = "fixtures/graph/valid/workshop-three-lane.json";
const DEMO_REPORT = "fixtures/workshop/runtime-preview-demo-report.json";
const DEMO_RUNBOOK = "docs/runbooks/workshop-runtime-preview-demo.md";

function runPreviewReport(): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", "--silent", "workshop:runtime-preview", "--", DEMO_FIXTURE], {
      cwd: process.cwd(),
      env: { ...process.env, ATL_ENV: "production", MODEL_PROVIDER: "real-provider" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("runtime Workshop preview demo report", () => {
  test("keeps a checked sanitized report in sync with the deterministic demo fixture", async () => {
    const [checkedReportText, live] = await Promise.all([
      readFile(DEMO_REPORT, "utf8"),
      runPreviewReport(),
    ]);

    assert.equal(live.code, 0, live.stderr);
    assert.equal(live.stderr, "");
    const checkedReport = JSON.parse(checkedReportText) as Record<string, unknown>;
    const liveReport = JSON.parse(live.stdout) as Record<string, unknown>;

    assert.deepEqual(checkedReport, liveReport);
    assert.equal(checkedReport.ok, true);
    assert.equal(checkedReport.kind, "runtime-workshop-preview-cli");
    assert.equal(checkedReport.command, "report");
    assert.equal(checkedReport.modelProvider, "fake");
    assert.equal(checkedReport.accountId, "acc_acme_robotics");
    assert.deepEqual(checkedReport.totals, {
      sources: 3,
      excerpts: 3,
      accepted_excerpts: 3,
      claims: 3,
      account_objects: 3,
      verified_objects: 3,
    });
    assert.deepEqual(checkedReport.lensItemCounts, {
      signals: 1,
      maps: 1,
      plays: 1,
    });
    assert.deepEqual(checkedReport.lensEvidencePacketCounts, {
      signals: 1,
      maps: 1,
      plays: 1,
    });
    assert.equal(checkedReport.providerCallsMade, 0);
    assert.equal(checkedReport.productionWrites, false);
    assert.equal(checkedReport.serverStarted, false);
    assert.equal(checkedReport.clientsConstructed, false);
    assert.equal(Object.hasOwn(checkedReport, "runtime"), false);
    assert.equal(Object.hasOwn(checkedReport, "html"), false);
    assert.equal(Object.hasOwn(checkedReport, "output_path"), false);
  });

  test("documents the exact no-write demo commands and boundary interpretation", async () => {
    const doc = await readFile(DEMO_RUNBOOK, "utf8");

    assert.match(doc, new RegExp(DEMO_FIXTURE.replaceAll("/", "\\/")));
    assert.match(doc, /npm run --silent workshop:runtime-preview -- fixtures\/graph\/valid\/workshop-three-lane\.json/);
    assert.match(doc, /npm run --silent workshop:runtime-preview:html -- fixtures\/graph\/valid\/workshop-three-lane\.json/);
    assert.match(doc, /fixtures\/workshop\/runtime-preview-demo-report\.json/);
    assert.match(doc, /providerCallsMade: 0/);
    assert.match(doc, /productionWrites: false/);
    assert.match(doc, /MODEL_PROVIDER=fake/);
    assert.match(doc, /does not approve live provider execution/i);
    assert.match(doc, /does not claim launch readiness/i);
    assert.doesNotMatch(doc, /API[_ -]?key|credential|secret|token/i);
  });
});
