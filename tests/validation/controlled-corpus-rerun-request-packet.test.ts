import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION,
  CONTROLLED_CORPUS_RERUN_REQUEST_PACKET_SCHEMA_VERSION,
  buildControlledCorpusRerunRequestPacket,
} from "../../src/index.ts";

const BASE_INPUT = Object.freeze({
  packetId: "controlled-2b-expanded-rerun-request-v1",
  requestedBy: "hermes",
  requestedAt: "2026-05-28T02:30:00.000Z",
  corpusRef: "external-corpus/controlled-2b-expanded-rerun-v1",
  maxAccounts: 3,
  maxOutputTokensPerAccount: 384,
  temperature: 0,
  roleRequests: Object.freeze([
    Object.freeze({
      role: "representative" as const,
      accountRef: "acct-representative-rerun",
      inputGraphRef: "corpus/controlled-2b-expanded/representative.json",
    }),
    Object.freeze({
      role: "edge-case" as const,
      accountRef: "acct-edge-rerun",
      inputGraphRef: "corpus/controlled-2b-expanded/edge-case.json",
    }),
    Object.freeze({
      role: "calibration" as const,
      accountRef: "acct-calibration-rerun",
      inputGraphRef: "corpus/controlled-2b-expanded/calibration.json",
    }),
  ]),
});

describe("controlled corpus rerun request packet", () => {
  test("builds a deterministic no-spend packet for all required corpus roles", () => {
    const packet = buildControlledCorpusRerunRequestPacket(BASE_INPUT);

    assert.equal(packet.schema_version, CONTROLLED_CORPUS_RERUN_REQUEST_PACKET_SCHEMA_VERSION);
    assert.equal(packet.prompt_schema_version, CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION);
    assert.equal(packet.mode, "no-spend-request-packet");
    assert.equal(packet.operation, "graph.propose");
    assert.equal(packet.packet_id, BASE_INPUT.packetId);
    assert.equal(packet.corpus_ref, BASE_INPUT.corpusRef);
    assert.equal(packet.max_accounts, 3);
    assert.equal(packet.max_output_tokens_per_account, 384);
    assert.equal(packet.temperature, 0);

    assert.deepEqual(packet.roles.map((item) => item.role), ["representative", "edge-case", "calibration"]);
    assert.deepEqual(packet.roles.map((item) => item.account_ref), [
      "acct-representative-rerun",
      "acct-edge-rerun",
      "acct-calibration-rerun",
    ]);

    for (const role of packet.roles) {
      assert.equal(role.operation, "graph.propose");
      assert.equal(role.prompt_contract.schema_version, CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION);
      assert.equal(role.prompt_contract.role, role.role);
      assert.match(role.prompt_contract.prompt_template, /Return only strict JSON/);
      assert.match(role.request_preview.prompt, /Return only strict JSON/);
      assert.equal(role.request_preview.mode, "model");
      assert.equal(role.request_preview.idempotencyKey, `${packet.packet_id}.${role.role}.${role.account_ref}`);
      assert.equal(role.request_preview.maxOutputTokens, packet.max_output_tokens_per_account);
      assert.equal(role.request_preview.temperature, 0);
      assert.equal(role.request_preview.metadata.packet_schema_version, packet.schema_version);
      assert.equal(role.request_preview.metadata.prompt_schema_version, packet.prompt_schema_version);
    }

    assert.deepEqual(packet.blocked_next_actions, [
      "live_provider_rerun",
      "provider_comparison",
      "corpus_expansion",
      "launch_readiness_claim",
      "product_readiness_claim",
    ]);
    assert.equal(packet.approves_live_provider_call, false);
    assert.equal(packet.approves_provider_spend, false);
    assert.equal(packet.approves_expansion_or_comparison, false);
    assert.equal(packet.launch_readiness_claim, false);
    assert.equal(packet.requires_separate_live_run_approval, true);
  });

  test("rejects missing roles, duplicate roles, and account count mismatches", () => {
    assert.throws(
      () => buildControlledCorpusRerunRequestPacket({ ...BASE_INPUT, roleRequests: BASE_INPUT.roleRequests.slice(0, 2) }),
      /controlled corpus rerun request packet rejected/,
    );
    assert.throws(
      () =>
        buildControlledCorpusRerunRequestPacket({
          ...BASE_INPUT,
          roleRequests: [BASE_INPUT.roleRequests[0]!, BASE_INPUT.roleRequests[0]!, BASE_INPUT.roleRequests[2]!],
        }),
      /controlled corpus rerun request packet rejected/,
    );
    assert.throws(
      () => buildControlledCorpusRerunRequestPacket({ ...BASE_INPUT, maxAccounts: 4 }),
      /controlled corpus rerun request packet rejected/,
    );
  });

  test("rejects unsafe refs and forbidden provider/credential fields from untyped callers", () => {
    for (const unsafeAccountRef of ["../secret", "http://example", ["127", "0", "0", "1"].join("."), "acct..bad"]) {
      assert.throws(
        () =>
          buildControlledCorpusRerunRequestPacket({
            ...BASE_INPUT,
            roleRequests: BASE_INPUT.roleRequests.map((item, index) =>
              index === 0 ? { ...item, accountRef: unsafeAccountRef } : item,
            ),
          }),
        /controlled corpus rerun request packet rejected/,
      );
    }

    assert.throws(
      () =>
        buildControlledCorpusRerunRequestPacket({
          ...BASE_INPUT,
          roleRequests: BASE_INPUT.roleRequests.map((item, index) =>
            index === 0 ? { ...item, inputGraphRef: "/private/source.json" } : item,
          ),
        }),
      /controlled corpus rerun request packet rejected/,
    );

    assert.throws(
      () => buildControlledCorpusRerunRequestPacket({ ...BASE_INPUT, provider: "openrouter", apiKey: "secret" } as never),
      /controlled corpus rerun request packet rejected/,
    );
    assert.throws(
      () =>
        buildControlledCorpusRerunRequestPacket({
          ...BASE_INPUT,
          roleRequests: BASE_INPUT.roleRequests.map((item, index) =>
            index === 0 ? ({ ...item, endpoint: "https://example.invalid" } as never) : item,
          ),
        }),
      /controlled corpus rerun request packet rejected/,
    );
  });

  test("rejects accessor, symbol, non-enumerable, and domain-shaped untrusted inputs", () => {
    const accessorInput = { ...BASE_INPUT } as Record<string, unknown>;
    Object.defineProperty(accessorInput, "corpusRef", {
      enumerable: true,
      get() {
        throw new Error("private getter detail must not leak");
      },
    });
    assert.throws(() => buildControlledCorpusRerunRequestPacket(accessorInput as never), {
      message: "controlled corpus rerun request packet rejected",
    });

    const nonEnumerableForbidden = { ...BASE_INPUT } as Record<string, unknown>;
    Object.defineProperty(nonEnumerableForbidden, "apiKey", { enumerable: false, value: "hidden" });
    assert.throws(() => buildControlledCorpusRerunRequestPacket(nonEnumerableForbidden as never), {
      message: "controlled corpus rerun request packet rejected",
    });

    const symbolForbidden = { ...BASE_INPUT, [Symbol("endpoint")]: "hidden" } as never;
    assert.throws(() => buildControlledCorpusRerunRequestPacket(symbolForbidden), {
      message: "controlled corpus rerun request packet rejected",
    });

    for (const ref of ["example.com", "db.internal", "localhost"]) {
      assert.throws(
        () =>
          buildControlledCorpusRerunRequestPacket({
            ...BASE_INPUT,
            roleRequests: BASE_INPUT.roleRequests.map((item, index) =>
              index === 0 ? { ...item, accountRef: ref } : item,
            ),
          }),
        /controlled corpus rerun request packet rejected/,
      );
    }

    assert.throws(
      () =>
        buildControlledCorpusRerunRequestPacket({
          ...BASE_INPUT,
          roleRequests: BASE_INPUT.roleRequests.map((item, index) =>
            index === 0 ? { ...item, inputGraphRef: "example.com/private.json" } : item,
          ),
        }),
      /controlled corpus rerun request packet rejected/,
    );

    for (const corpusRef of [
      "external-corpus/private-evidence/controlled",
      "external-corpus/PRIVATE-evidence/controlled",
      "external-corpus/example.com/controlled",
      ["external-corpus", ["127", "0", "0", "1"].join("."), "controlled"].join("/"),
    ]) {
      assert.throws(
        () => buildControlledCorpusRerunRequestPacket({ ...BASE_INPUT, corpusRef }),
        /controlled corpus rerun request packet rejected/,
      );
    }

    for (const inputGraphRef of [
      "corpus/example.com/representative.json",
      "corpus/private-evidence/representative.json",
      ["corpus", `${["127", "0", "0", "1"].join(".")}.json`].join("/"),
      "corpus/example.com.json",
      "corpus/PRIVATE-evidence/representative.json",
    ]) {
      assert.throws(
        () =>
          buildControlledCorpusRerunRequestPacket({
            ...BASE_INPUT,
            roleRequests: BASE_INPUT.roleRequests.map((item, index) =>
              index === 0 ? { ...item, inputGraphRef } : item,
            ),
          }),
        /controlled corpus rerun request packet rejected/,
      );
    }
  });

  test("rejects inherited and array-accessor fields before snapshotting", () => {
    const inheritedTopLevel = Object.create({ corpusRef: BASE_INPUT.corpusRef }) as Record<string, unknown>;
    for (const [key, value] of Object.entries({ ...BASE_INPUT, corpusRef: undefined })) {
      if (value !== undefined) Object.defineProperty(inheritedTopLevel, key, { enumerable: true, value });
    }
    assert.throws(() => buildControlledCorpusRerunRequestPacket(inheritedTopLevel as never), {
      message: "controlled corpus rerun request packet rejected",
    });

    const inheritedRole = Object.create({ accountRef: BASE_INPUT.roleRequests[0]!.accountRef }) as Record<string, unknown>;
    Object.defineProperty(inheritedRole, "role", { enumerable: true, value: BASE_INPUT.roleRequests[0]!.role });
    Object.defineProperty(inheritedRole, "inputGraphRef", {
      enumerable: true,
      value: BASE_INPUT.roleRequests[0]!.inputGraphRef,
    });
    assert.throws(
      () =>
        buildControlledCorpusRerunRequestPacket({
          ...BASE_INPUT,
          roleRequests: [inheritedRole as never, BASE_INPUT.roleRequests[1]!, BASE_INPUT.roleRequests[2]!],
        }),
      /controlled corpus rerun request packet rejected/,
    );

    const roleRequestsWithAccessor = [...BASE_INPUT.roleRequests] as unknown[];
    Object.defineProperty(roleRequestsWithAccessor, "0", {
      enumerable: true,
      get() {
        throw new Error("private array getter detail must not leak");
      },
    });
    assert.throws(
      () => buildControlledCorpusRerunRequestPacket({ ...BASE_INPUT, roleRequests: roleRequestsWithAccessor as never }),
      { message: "controlled corpus rerun request packet rejected" },
    );

    for (const key of ["provider", "apiKey", "endpoint"]) {
      const roleRequestsWithHiddenField = [...BASE_INPUT.roleRequests] as unknown[];
      Object.defineProperty(roleRequestsWithHiddenField, key, { enumerable: key === "provider", value: "hidden" });
      assert.throws(
        () => buildControlledCorpusRerunRequestPacket({ ...BASE_INPUT, roleRequests: roleRequestsWithHiddenField as never }),
        /controlled corpus rerun request packet rejected/,
      );
    }

    const roleRequestsWithSymbolField = [...BASE_INPUT.roleRequests] as unknown[];
    Object.defineProperty(roleRequestsWithSymbolField, Symbol("endpoint"), { enumerable: true, value: "hidden" });
    assert.throws(
      () => buildControlledCorpusRerunRequestPacket({ ...BASE_INPUT, roleRequests: roleRequestsWithSymbolField as never }),
      /controlled corpus rerun request packet rejected/,
    );

    const inheritedForbiddenTopLevel = Object.assign(Object.create({ provider: "hidden" }), BASE_INPUT);
    assert.throws(() => buildControlledCorpusRerunRequestPacket(inheritedForbiddenTopLevel as never), {
      message: "controlled corpus rerun request packet rejected",
    });

    const inheritedForbiddenRole = Object.assign(Object.create({ endpoint: "hidden" }), BASE_INPUT.roleRequests[0]);
    assert.throws(
      () =>
        buildControlledCorpusRerunRequestPacket({
          ...BASE_INPUT,
          roleRequests: [inheritedForbiddenRole as never, BASE_INPUT.roleRequests[1]!, BASE_INPUT.roleRequests[2]!],
        }),
      /controlled corpus rerun request packet rejected/,
    );

    const inheritedForbiddenRoleRequests = Object.assign(Object.create({ apiKey: "hidden" }), [
      ...BASE_INPUT.roleRequests,
    ]) as unknown[];
    assert.throws(
      () => buildControlledCorpusRerunRequestPacket({ ...BASE_INPUT, roleRequests: inheritedForbiddenRoleRequests as never }),
      /controlled corpus rerun request packet rejected/,
    );

    Object.defineProperty(Object.prototype, "provider", { configurable: true, value: "hidden" });
    try {
      assert.throws(() => buildControlledCorpusRerunRequestPacket(BASE_INPUT), {
        message: "controlled corpus rerun request packet rejected",
      });
    } finally {
      delete (Object.prototype as Record<string, unknown>).provider;
    }

    Object.defineProperty(Array.prototype, "apiKey", { configurable: true, value: "hidden" });
    try {
      assert.throws(() => buildControlledCorpusRerunRequestPacket(BASE_INPUT), {
        message: "controlled corpus rerun request packet rejected",
      });
    } finally {
      delete (Array.prototype as unknown as Record<string, unknown>).apiKey;
    }
  });

  test("does not read process.env and returns defensive immutable copies", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });

    try {
      const packet = buildControlledCorpusRerunRequestPacket(BASE_INPUT);
      assert.throws(() => ((packet as { packet_id: string }).packet_id = "mutated"), TypeError);
      assert.throws(() => ((packet.roles as unknown as unknown[]).push({})), TypeError);
      assert.throws(() => ((packet.roles[0]!.request_preview.metadata as Record<string, string>).extra = "bad"), TypeError);
    } finally {
      if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
    }
  });
});
