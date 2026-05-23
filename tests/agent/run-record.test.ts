import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  AGENT_RUN_RECORD_SCHEMA_VERSION,
  createAgentRunRecord,
  transitionAgentRunRecord,
} from "../../src/agent/run-record.ts";

describe("AgentRun record seam", () => {
  it("creates a pure orchestration record that references research runs and run artifacts", () => {
    const record = createAgentRunRecord({
      id: "agn_fixture_run",
      researchRunId: "run_fixture_1",
      operation: "graph.propose",
      mode: "fixture",
      status: "planned",
      inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
      createdAt: "2026-05-23T19:30:00.000Z",
      updatedAt: "2026-05-23T19:30:00.000Z",
      queueJobId: "job_fixture_1",
      artifacts: [
        {
          role: "input_graph",
          runArtifactId: "art_input_graph",
          ref: "runs/fixture/graph-bundle.json",
        },
      ],
      metadata: { phase: "agent-foundation" },
    });

    assert.equal(record.schema_version, AGENT_RUN_RECORD_SCHEMA_VERSION);
    assert.equal(record.id, "agn_fixture_run");
    assert.equal(record.research_run_id, "run_fixture_1");
    assert.equal(record.status, "planned");
    assert.equal(record.operation, "graph.propose");
    assert.equal(record.mode, "fixture");
    assert.equal(record.input_graph_ref, "fixtures/graph/valid/minimal-pass.json");
    assert.equal(record.queue_job_id, "job_fixture_1");
    assert.deepEqual(record.artifacts, [
      {
        role: "input_graph",
        run_artifact_id: "art_input_graph",
        ref: "runs/fixture/graph-bundle.json",
      },
    ]);
    assert.deepEqual(record.metadata, { phase: "agent-foundation" });
  });

  it("rejects unsafe IDs, refs, statuses, and artifact roles before any orchestration wiring exists", () => {
    const valid = {
      id: "agn_fixture_run",
      researchRunId: "run_fixture_1",
      operation: "graph.propose" as const,
      mode: "fixture" as const,
      status: "planned" as const,
      inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
      createdAt: "2026-05-23T19:30:00.000Z",
      updatedAt: "2026-05-23T19:30:00.000Z",
      artifacts: [],
    };

    assert.throws(() => createAgentRunRecord({ ...valid, id: "run_fixture_1" }), /agent run id/i);
    assert.throws(() => createAgentRunRecord({ ...valid, id: "agn_http://host" }), /agent run id/i);
    assert.throws(() => createAgentRunRecord({ ...valid, researchRunId: "src_fixture_1" }), /research run id/i);
    assert.throws(() => createAgentRunRecord({ ...valid, inputGraphRef: "https://example.invalid/graph.json" }), /input graph ref/i);
    assert.throws(() => createAgentRunRecord({ ...valid, inputGraphRef: "../graph.json" }), /input graph ref/i);
    assert.throws(() => createAgentRunRecord({ ...valid, inputGraphRef: "runs/./graph.json" }), /input graph ref/i);
    assert.throws(() => createAgentRunRecord({ ...valid, inputGraphRef: "runs//graph.json" }), /input graph ref/i);
    assert.throws(() => createAgentRunRecord({ ...valid, inputGraphRef: "runs/fixture/" }), /input graph ref/i);
    assert.throws(() => createAgentRunRecord({ ...valid, inputGraphRef: "runs/.hidden/graph.json" }), /input graph ref/i);
    assert.throws(() => createAgentRunRecord({ ...valid, queueJobId: "https://queue.example.invalid/job" }), /queue job id/i);
    assert.throws(
      () => createAgentRunRecord({
        ...valid,
        artifacts: [{ role: "input_graph", runArtifactId: "run_wrong", ref: "runs/fixture/graph.json" }],
      }),
      /run artifact id/i,
    );
    assert.throws(
      () => createAgentRunRecord({
        ...valid,
        artifacts: [{ role: "model_output" as never, runArtifactId: "art_output", ref: "runs/fixture/output.json" }],
      }),
      /artifact role/i,
    );
  });

  it("returns defensive copies of artifacts and metadata", () => {
    const artifacts: Array<{ role: "input_graph" | "quality_gate_report"; runArtifactId: string; ref: string }> = [
      { role: "input_graph", runArtifactId: "art_input", ref: "runs/fixture/graph.json" },
    ];
    const metadata = { phase: "agent-foundation" };
    const record = createAgentRunRecord({
      id: "agn_fixture_run",
      researchRunId: "run_fixture_1",
      operation: "graph.propose",
      mode: "fixture",
      status: "planned",
      inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
      createdAt: "2026-05-23T19:30:00.000Z",
      updatedAt: "2026-05-23T19:30:00.000Z",
      artifacts,
      metadata,
    });

    artifacts[0] = { role: "quality_gate_report", runArtifactId: "art_changed", ref: "runs/fixture/changed.json" };
    metadata.phase = "changed";

    assert.deepEqual(record.artifacts, [
      { role: "input_graph", run_artifact_id: "art_input", ref: "runs/fixture/graph.json" },
    ]);
    assert.deepEqual(record.metadata, { phase: "agent-foundation" });
  });

  it("transitions statuses without mutating the original record and rejects terminal rewrites", () => {
    const planned = createAgentRunRecord({
      id: "agn_fixture_run",
      researchRunId: "run_fixture_1",
      operation: "graph.propose",
      mode: "fixture",
      status: "planned",
      inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
      createdAt: "2026-05-23T19:30:00.000Z",
      updatedAt: "2026-05-23T19:30:00.000Z",
      artifacts: [],
    });

    const running = transitionAgentRunRecord(planned, "running", "2026-05-23T19:31:00.000Z");
    const succeeded = transitionAgentRunRecord(running, "succeeded", "2026-05-23T19:32:00.000Z");

    assert.equal(planned.status, "planned");
    assert.equal(running.status, "running");
    assert.equal(running.updated_at, "2026-05-23T19:31:00.000Z");
    assert.equal(succeeded.status, "succeeded");
    assert.throws(() => transitionAgentRunRecord(succeeded, "running", "2026-05-23T19:33:00.000Z"), /terminal/i);
    assert.throws(() => transitionAgentRunRecord(planned, "succeeded", "2026-05-23T19:31:00.000Z"), /invalid status transition/i);
  });

  it("rejects invalid runtime modes and invalid record status when transitioning deserialized records", () => {
    const valid = {
      id: "agn_fixture_run",
      researchRunId: "run_fixture_1",
      operation: "graph.propose" as const,
      mode: "fixture" as const,
      status: "planned" as const,
      inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
      createdAt: "2026-05-23T19:30:00.000Z",
      updatedAt: "2026-05-23T19:30:00.000Z",
      artifacts: [],
    };

    assert.throws(() => createAgentRunRecord({ ...valid, mode: "prod" as never }), /runtime mode/i);

    const record = createAgentRunRecord(valid);
    assert.throws(
      () => transitionAgentRunRecord({ ...record, status: "done" as never }, "running", "2026-05-23T19:31:00.000Z"),
      /agent run status/i,
    );
    assert.throws(
      () => transitionAgentRunRecord({ ...record, schema_version: "atliera.agent_run.v0" as never }, "running", "2026-05-23T19:31:00.000Z"),
      /schema version/i,
    );
  });

  it("requires strict ISO timestamps and monotonic lifecycle updates", () => {
    const valid = {
      id: "agn_fixture_run",
      researchRunId: "run_fixture_1",
      operation: "graph.propose" as const,
      mode: "fixture" as const,
      status: "planned" as const,
      inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
      createdAt: "2026-05-23T19:30:00.000Z",
      updatedAt: "2026-05-23T19:30:00.000Z",
      artifacts: [],
    };

    assert.throws(() => createAgentRunRecord({ ...valid, createdAt: "2026/05/23 19:30:00" }), /ISO timestamp/i);
    assert.throws(() => createAgentRunRecord({ ...valid, createdAt: "2026-02-31T00:00:00.000Z" }), /ISO timestamp/i);
    assert.throws(
      () => createAgentRunRecord({ ...valid, updatedAt: "2026-05-23T19:29:59.999Z" }),
      /updatedAt must not be before createdAt/i,
    );

    const running = transitionAgentRunRecord(createAgentRunRecord(valid), "running", "2026-05-23T19:31:00.000Z");
    assert.throws(() => transitionAgentRunRecord(running, "succeeded", "2026-05-23T19:30:59.999Z"), /updatedAt must not go backwards/i);
  });

  it("freezes returned records, artifacts, and metadata", () => {
    const record = createAgentRunRecord({
      id: "agn_fixture_run",
      researchRunId: "run_fixture_1",
      operation: "graph.propose",
      mode: "fixture",
      status: "planned",
      inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
      createdAt: "2026-05-23T19:30:00.000Z",
      updatedAt: "2026-05-23T19:30:00.000Z",
      artifacts: [{ role: "input_graph", runArtifactId: "art_input", ref: "runs/fixture/graph.json" }],
      metadata: { phase: "agent-foundation" },
    });

    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.artifacts), true);
    assert.equal(Object.isFrozen(record.artifacts[0]), true);
    assert.equal(Object.isFrozen(record.metadata), true);
    assert.throws(() => ((record as { status: string }).status = "running"), /read only|Cannot assign/i);
    assert.throws(() => ((record.metadata as Record<string, string>).phase = "changed"), /read only|Cannot assign/i);
  });

  it("does not read process.env while creating or transitioning records", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read by AgentRun records");
      },
    });

    try {
      const record = createAgentRunRecord({
        id: "agn_fixture_run",
        researchRunId: "run_fixture_1",
        operation: "graph.propose",
        mode: "fixture",
        status: "planned",
        inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
        createdAt: "2026-05-23T19:30:00.000Z",
        updatedAt: "2026-05-23T19:30:00.000Z",
        artifacts: [],
      });

      assert.equal(transitionAgentRunRecord(record, "cancelled", "2026-05-23T19:31:00.000Z").status, "cancelled");
    } finally {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(process, "env", originalDescriptor);
      }
    }
  });
});
