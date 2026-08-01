import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";

import {
  createValidatedCandidate,
  hydrateValidatedCandidate,
  ValidatedCandidateBoundaryError,
  WorkshopGraphValidationError,
} from "../../src/graph/validated-candidate.ts";
import {
  clone,
  makeValidBundle,
  VALID_GRAPH_SUBJECT,
} from "../fixtures/valid-graph.ts";

describe("ValidatedCandidate", () => {
  test("is a recursively frozen exact serializable snapshot with authoritative subject", () => {
    const subject: { team_id: string; account_id: string } = {
      ...VALID_GRAPH_SUBJECT,
    };
    const bundle = clone(makeValidBundle());
    bundle.account_objects[0]!.payload_json.nested = { value: "original" };

    const candidate = createValidatedCandidate(bundle, subject);
    const serialized = JSON.stringify(candidate);

    subject.account_id = "acc_mutated";
    bundle.account_objects[0]!.title = "Mutated title";
    bundle.account_objects[0]!.summary = "Mutated summary";
    (bundle.account_objects[0]!.payload_json.nested as { value: string }).value =
      "mutated";

    assert.deepEqual(Object.keys(candidate), [
      "kind",
      "version",
      "subject",
      "graph_bundle",
    ]);
    assert.equal(candidate.kind, "atliera_validated_candidate");
    assert.equal(candidate.version, 1);
    assert.equal(candidate.subject.account_id, VALID_GRAPH_SUBJECT.account_id);
    assert.equal(
      candidate.graph_bundle.account_objects[0]!.title,
      "New logistics platform launch",
    );
    assert.equal(
      candidate.graph_bundle.account_objects[0]!.summary,
      "Acme Robotics shipped a logistics platform on March 1, 2026.",
    );
    assert.deepEqual(candidate.graph_bundle.account_objects[0]!.payload_json.nested, {
      value: "original",
    });
    assert.equal(JSON.stringify(candidate), serialized);
    assert.equal(Object.isFrozen(candidate), true);
    assert.equal(Object.isFrozen(candidate.subject), true);
    assert.equal(Object.isFrozen(candidate.graph_bundle), true);
    assert.equal(Object.isFrozen(candidate.graph_bundle.account_objects), true);
    assert.equal(
      Object.isFrozen(candidate.graph_bundle.account_objects[0]!.payload_json.nested),
      true,
    );
  });

  test("hydrates a JSON-round-tripped candidate and revalidates the exact envelope", () => {
    const candidate = createValidatedCandidate(
      makeValidBundle(),
      VALID_GRAPH_SUBJECT,
    );
    const roundTripped = JSON.parse(JSON.stringify(candidate)) as unknown;

    assert.deepEqual(hydrateValidatedCandidate(roundTripped), candidate);

    const extraEnvelopeField = JSON.parse(JSON.stringify(candidate)) as Record<
      string,
      unknown
    >;
    extraEnvelopeField.extra = true;
    assert.throws(
      () => hydrateValidatedCandidate(extraEnvelopeField),
      ValidatedCandidateBoundaryError,
    );
  });

  test("builds the same Workshop projection after serialization into a fresh process", () => {
    const serializedCandidate = JSON.stringify(
      createValidatedCandidate(makeValidBundle(), VALID_GRAPH_SUBJECT),
    );
    const workshopViewModelModuleUrl = new URL(
      "../../src/workshop/view-model.ts",
      import.meta.url,
    ).href;
    const childScript = `
      import { buildWorkshopViewModel } from ${JSON.stringify(workshopViewModelModuleUrl)};

      let serializedCandidate = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) serializedCandidate += chunk;

      const viewModel = buildWorkshopViewModel(JSON.parse(serializedCandidate));
      const item = viewModel.lenses.signals[0];
      if (item === undefined) throw new Error("Expected a Signals item");

      process.stdout.write(JSON.stringify({
        account_id: viewModel.account_id,
        item_id: item.id,
        trust_label: item.trust.label,
      }));
    `;

    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", childScript],
      {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
        input: serializedCandidate,
      },
    );

    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stderr, "");
    assert.notEqual(child.stdout, "");
    assert.deepEqual(JSON.parse(child.stdout), {
      account_id: "acc_acme_robotics",
      item_id: "obj_acme_signal_launch",
      trust_label: "Reviewed · source-backed",
    });
  });

  test("rejects a semantically tampered serialized candidate with a ValidationReport", () => {
    const tampered = JSON.parse(
      JSON.stringify(
        createValidatedCandidate(makeValidBundle(), VALID_GRAPH_SUBJECT),
      ),
    ) as ReturnType<typeof createValidatedCandidate>;
    tampered.graph_bundle.claim_evidence[0]!.claim_id = "clm_missing";

    assert.throws(() => hydrateValidatedCandidate(tampered), (error) => {
      assert.ok(error instanceof WorkshopGraphValidationError);
      assert.equal(error.report.ok, false);
      assert.ok(
        error.report.hard_failures.some(
          (failure) => failure.code === "invented_claim_id",
        ),
      );
      return true;
    });
  });

  test("rejects hostile accessors and Proxies before executing their traps", () => {
    let getterCalls = 0;
    const accessorBundle = clone(makeValidBundle()) as unknown as Record<
      string,
      unknown
    >;
    Object.defineProperty(accessorBundle, "sources", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return [];
      },
    });
    assert.throws(
      () => createValidatedCandidate(accessorBundle, VALID_GRAPH_SUBJECT),
      ValidatedCandidateBoundaryError,
    );
    assert.equal(getterCalls, 0);

    let proxyTrapCalls = 0;
    const proxyBundle = new Proxy(makeValidBundle(), {
      get(target, property, receiver) {
        proxyTrapCalls += 1;
        return Reflect.get(target, property, receiver);
      },
      ownKeys(target) {
        proxyTrapCalls += 1;
        return Reflect.ownKeys(target);
      },
    });
    assert.throws(
      () => createValidatedCandidate(proxyBundle, VALID_GRAPH_SUBJECT),
      ValidatedCandidateBoundaryError,
    );
    assert.equal(proxyTrapCalls, 0);

    const valid = createValidatedCandidate(makeValidBundle(), VALID_GRAPH_SUBJECT);
    const accessorEnvelope = JSON.parse(JSON.stringify(valid)) as Record<
      string,
      unknown
    >;
    Object.defineProperty(accessorEnvelope, "graph_bundle", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return makeValidBundle();
      },
    });
    assert.throws(
      () => hydrateValidatedCandidate(accessorEnvelope),
      ValidatedCandidateBoundaryError,
    );
    assert.equal(getterCalls, 0);

    const proxyEnvelope = new Proxy(JSON.parse(JSON.stringify(valid)), {
      get(target, property, receiver) {
        proxyTrapCalls += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    assert.throws(
      () => hydrateValidatedCandidate(proxyEnvelope),
      ValidatedCandidateBoundaryError,
    );
    assert.equal(proxyTrapCalls, 0);
  });

  test("rejects symbol-keyed, exotic, sparse, extra-property, cyclic, and non-JSON input", () => {
    const symbolKeyed = clone(makeValidBundle()) as unknown as Record<
      PropertyKey,
      unknown
    >;
    symbolKeyed[Symbol("hostile")] = true;

    const exotic = clone(makeValidBundle());
    Object.setPrototypeOf(exotic.account_objects[0]!.payload_json, null);

    const sparse = clone(makeValidBundle());
    sparse.sources.length = 2;

    const extraArrayProperty = clone(makeValidBundle());
    (extraArrayProperty.sources as unknown as Record<string, unknown>).extra = true;

    const cyclic = clone(makeValidBundle());
    cyclic.account_objects[0]!.payload_json.cycle = cyclic;

    const nonJson = clone(makeValidBundle());
    nonJson.account_objects[0]!.payload_json.value = undefined;

    for (const hostile of [
      symbolKeyed,
      exotic,
      sparse,
      extraArrayProperty,
      cyclic,
      nonJson,
    ]) {
      assert.throws(
        () => createValidatedCandidate(hostile, VALID_GRAPH_SUBJECT),
        ValidatedCandidateBoundaryError,
      );
    }
  });
});
