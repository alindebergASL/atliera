import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { initializeLocalDurableDb } from "../../src/db/local-durable-db.ts";
import { buildM5aCuratedProposalFlowApprovalPacket } from "../../src/workshop/m5a-curated-proposal-flow-approval-packet.ts";
import { buildM5aCuratedProposalFlowContract } from "../../src/workshop/m5a-curated-proposal-flow-contract.ts";
import { executeM5aCuratedProposalFlow } from "../../src/workshop/m5a-curated-proposal-flow-execution.ts";
import { buildM5aCuratedProposalFlowOperatorArming } from "../../src/workshop/m5a-curated-proposal-flow-operator-arming.ts";
import { renderWorkshopHtml } from "../../src/workshop/render-html.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import { makeValidBundle } from "../fixtures/valid-graph.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const INPUT_PATH = join(ROOT, "fixtures/validation/m5a-curated-proposal-flow-capstone-20260710a-input.json");
const MODULE_PATH = join(ROOT, "src/workshop/m5a-curated-proposal-flow-execution.ts");

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function legitimate() {
  const input = JSON.parse(await readFile(INPUT_PATH, "utf8")) as Record<string, unknown>;
  const contract = buildM5aCuratedProposalFlowContract(input, {
    flowId: "m5a-capstone-flow-20260710a",
    now: "2026-07-10T09:00:00Z",
  });
  const packet = buildM5aCuratedProposalFlowApprovalPacket(contract, {
    now: "2026-07-10T09:00:00Z",
    draftedBy: "reviewer_demo",
    expiresAt: "2026-07-11T09:00:00Z",
  });
  const arming = buildM5aCuratedProposalFlowOperatorArming(contract, packet, {
    armedAt: "2026-07-10T10:00:00Z",
    armedBy: "operator_demo",
  });
  const dbRootDir = await mkdtemp(join(tmpdir(), "atliera-m5a-step4-safety-"));
  await initializeLocalDurableDb({ rootDir: dbRootDir, now: "2026-07-10T08:00:00.000Z" });
  return {
    input,
    contract,
    packet,
    arming,
    dbRootDir,
    options: {
      contract,
      approvalPacket: packet,
      arming,
      materializationInput: input,
      dbRootDir,
      now: "2026-07-10T11:00:00Z",
    },
    cleanup: () => rm(dbRootDir, { recursive: true, force: true }),
  };
}

function traplessProxy<T extends object>(target: T, counter: { count: number }): T {
  return new Proxy(target, {
    get() { counter.count += 1; throw new Error("proxy get trap executed"); },
    getPrototypeOf() { counter.count += 1; throw new Error("proxy getPrototypeOf trap executed"); },
    ownKeys() { counter.count += 1; throw new Error("proxy ownKeys trap executed"); },
    getOwnPropertyDescriptor() {
      counter.count += 1;
      throw new Error("proxy descriptor trap executed");
    },
  });
}

describe("M5a Step 4 hostile-input and purity boundaries", () => {
  test("Proxy-backed contract, packet, and arming refuse without invoking traps", async () => {
    for (const key of ["contract", "approvalPacket", "arming"] as const) {
      const ctx = await legitimate();
      try {
        const counter = { count: 0 };
        const hostile = traplessProxy(ctx.options[key], counter);
        const result = await executeM5aCuratedProposalFlow({ ...ctx.options, [key]: hostile });
        assert.equal(result.outcome, "refused");
        assert.equal(counter.count, 0, `${key} proxy trap ran`);
      } finally {
        await ctx.cleanup();
      }
    }
  });

  test("accessor-backed contract, packet, and arming refuse without invoking getters", async () => {
    for (const [key, field] of [
      ["contract", "flow_id"],
      ["approvalPacket", "packet_artifact_id"],
      ["arming", "one_shot_consumption_key"],
    ] as const) {
      const ctx = await legitimate();
      try {
        let invoked = false;
        const hostile = clone(ctx.options[key]) as unknown as Record<string, unknown>;
        Object.defineProperty(hostile, field, {
          enumerable: true,
          get() { invoked = true; return "counterfeit"; },
        });
        const result = await executeM5aCuratedProposalFlow({ ...ctx.options, [key]: hostile });
        assert.equal(result.outcome, "refused");
        assert.equal(invoked, false, `${key}.${field} getter ran`);
      } finally {
        await ctx.cleanup();
      }
    }
  });

  test("materialization root, nested record, and array Proxy/accessor inputs refuse traplessly", async () => {
    const cases: Array<(input: Record<string, unknown>, counter: { count: number }) => unknown> = [
      (input, counter) => traplessProxy(input, counter),
      (input, counter) => {
        const copy = clone(input);
        (copy.public_sources as unknown[])[0] = traplessProxy(
          (copy.public_sources as object[])[0]!,
          counter,
        );
        return copy;
      },
      (input, counter) => {
        const copy = clone(input);
        copy.proposed_claims = traplessProxy(copy.proposed_claims as unknown[], counter);
        return copy;
      },
    ];
    for (const makeHostile of cases) {
      const ctx = await legitimate();
      try {
        const counter = { count: 0 };
        const result = await executeM5aCuratedProposalFlow({
          ...ctx.options,
          materializationInput: makeHostile(ctx.input, counter),
        });
        assert.equal(result.outcome, "refused");
        assert.equal(counter.count, 0);
      } finally {
        await ctx.cleanup();
      }
    }

    const ctx = await legitimate();
    try {
      let getterInvoked = false;
      const accessorInput = clone(ctx.input);
      const first = (accessorInput.proposed_account_objects as Record<string, unknown>[])[0]!;
      Object.defineProperty(first, "title", {
        enumerable: true,
        get() { getterInvoked = true; return "counterfeit"; },
      });
      const result = await executeM5aCuratedProposalFlow({
        ...ctx.options,
        materializationInput: accessorInput,
      });
      assert.equal(result.outcome, "refused");
      assert.equal(getterInvoked, false);

      let rootGetterInvoked = false;
      const rootAccessor = clone(ctx.input);
      Object.defineProperty(rootAccessor, "context", {
        enumerable: true,
        get() { rootGetterInvoked = true; return ctx.input.context; },
      });
      const rootResult = await executeM5aCuratedProposalFlow({
        ...ctx.options,
        materializationInput: rootAccessor,
      });
      assert.equal(rootResult.outcome, "refused");
      assert.equal(rootGetterInvoked, false);

      let arrayGetterInvoked = false;
      const arrayAccessor = clone(ctx.input);
      Object.defineProperty(arrayAccessor.proposed_excerpts as unknown[], "0", {
        enumerable: true,
        get() { arrayGetterInvoked = true; return (ctx.input.proposed_excerpts as unknown[])[0]; },
      });
      const arrayResult = await executeM5aCuratedProposalFlow({
        ...ctx.options,
        materializationInput: arrayAccessor,
      });
      assert.equal(arrayResult.outcome, "refused");
      assert.equal(arrayGetterInvoked, false);
    } finally {
      await ctx.cleanup();
    }
  });

  test("symbol, unsafe-key, and unknown-key counterfeits refuse", async () => {
    const ctx = await legitimate();
    try {
      const symbolContract = clone(ctx.contract) as unknown as Record<PropertyKey, unknown>;
      symbolContract[Symbol("counterfeit")] = true;
      assert.equal(
        (await executeM5aCuratedProposalFlow({ ...ctx.options, contract: symbolContract })).outcome,
        "refused",
      );

      const unsafeInput = clone(ctx.input);
      Object.defineProperty(unsafeInput, "__proto__", {
        value: "counterfeit",
        enumerable: true,
      });
      assert.equal(
        (await executeM5aCuratedProposalFlow({ ...ctx.options, materializationInput: unsafeInput })).outcome,
        "refused",
      );

      const unknownArming = { ...clone(ctx.arming), unexpected_authority: true };
      assert.equal(
        (await executeM5aCuratedProposalFlow({ ...ctx.options, arming: unknownArming })).outcome,
        "refused",
      );

      const unknownMaterialization = { ...clone(ctx.input), unexpected_input: true };
      assert.equal(
        (await executeM5aCuratedProposalFlow({
          ...ctx.options,
          materializationInput: unknownMaterialization,
        })).outcome,
        "refused",
      );
    } finally {
      await ctx.cleanup();
    }
  });

  test("default renderer output is byte-identical when curated options are absent", () => {
    const vm = buildWorkshopViewModel(makeValidBundle());
    const implicit = renderWorkshopHtml(vm);
    const explicit = renderWorkshopHtml(vm, { previewMode: "fake" });
    assert.equal(implicit, explicit);
    assert.doesNotMatch(implicit, /data-curated-provenance/);
    assert.doesNotMatch(implicit, /Curated public source/);
  });

  test("execution module has no provider SDK, network, environment, process spawn, dynamic load, HTTP, deployment, or production path wiring", async () => {
    const source = await readFile(MODULE_PATH, "utf8");
    for (const forbidden of [
      /from\s+["'][^"']*(?:openai|anthropic|provider)[^"']*["']/i,
      /\bfetch\s*\(/,
      /\bprocess\.env\b/,
      /node:child_process|child_process/,
      /\brequire\s*\(/,
      /\bimport\s*\(/,
      /node:https?|from\s+["']https?["']/,
      /\/deployment\//,
      /production[-_ ](?:path|target|endpoint|deploy)/i,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
    assert.match(source, /Buffer\.byteLength\(value, "utf8"\)/);
    assert.doesNotMatch(source, /Buffer\.from\(value|new TextEncoder\(/);
    const executeSource = source.slice(source.indexOf("export async function executeM5aCuratedProposalFlow"));
    const snapshotBoundary = executeSource.indexOf("snapshotRootOptions(options)");
    const canonicalizationBoundary = executeSource.indexOf("sha256M5aMaterializationInputSnapshot");
    const preflightBoundary = executeSource.indexOf("evaluateM5aCuratedProposalWorkshopBundle");
    const lockBoundary = executeSource.indexOf("acquireGraphSnapshotWriteLock");
    assert.ok(snapshotBoundary >= 0);
    assert.ok(canonicalizationBoundary > snapshotBoundary);
    assert.ok(preflightBoundary > canonicalizationBoundary);
    assert.ok(lockBoundary > preflightBoundary);
  });

  test("every named post-rename failure is represented as committed_unrendered, never thrown as a refusal", async () => {
    const source = await readFile(MODULE_PATH, "utf8");
    const renameBoundary = source.indexOf("await rename(tempPath, graphPath);");
    assert.ok(renameBoundary >= 0, "rename boundary not found");
    const postCommit = source.slice(renameBoundary);
    for (const failureCode of [
      "post_commit_read_back_failed",
      "post_commit_row_mismatch",
      "post_commit_view_model_failed",
      "post_commit_render_failed",
      "post_commit_success_criterion_failed",
    ]) {
      assert.match(postCommit, new RegExp(`["]${failureCode}["]`));
    }
    assert.doesNotMatch(postCommit, /throw\s+/);
    assert.match(postCommit, /canonicalJson\(matches\[0\]\)\s*!==\s*canonicalJson\(row\)/);
    assert.match(source, /outcome:\s*"committed_unrendered"/);
    assert.match(source, /l0_effect_observed:\s*true/);
    assert.match(source, /durable_write_performed:\s*true/);
    assert.match(source, /durable_read_back_attempted:\s*true/);
    assert.match(source, /rendered_artifacts:\s*0/);
  });
});
