import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initializeLocalDurableDb } from "../src/db/local-durable-db.ts";
import { buildM5aCuratedProposalFlowApprovalPacket } from "../src/workshop/m5a-curated-proposal-flow-approval-packet.ts";
import { buildM5aCuratedProposalFlowContract } from "../src/workshop/m5a-curated-proposal-flow-contract.ts";
import { executeM5aCuratedProposalFlow } from "../src/workshop/m5a-curated-proposal-flow-execution.ts";
import { buildM5aCuratedProposalFlowOperatorArming } from "../src/workshop/m5a-curated-proposal-flow-operator-arming.ts";

const root = process.cwd();
const inputPath = join(
  root,
  "fixtures/validation/m5a-curated-proposal-flow-capstone-20260710a-input.json",
);
const outputPath = join(
  root,
  "fixtures/workshop/m5a-curated-proposal-flow-capstone.html",
);

const input = JSON.parse(await readFile(inputPath, "utf8")) as Record<string, unknown>;
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

const dbRootDir = await mkdtemp(join(tmpdir(), "atliera-m5a-capstone-generator-"));
try {
  const initialized = await initializeLocalDurableDb({
    rootDir: dbRootDir,
    now: "2026-07-10T08:00:00.000Z",
  });
  if (!initialized.ok) throw new Error("M5a capstone temp DB initialization refused");

  const outcome = await executeM5aCuratedProposalFlow({
    contract,
    approvalPacket: packet,
    arming,
    materializationInput: input,
    dbRootDir,
    now: "2026-07-10T11:00:00Z",
  });
  if (outcome.outcome !== "completed") {
    const code = outcome.outcome === "refused" ? outcome.refusal_code : outcome.failure_code;
    throw new Error(`M5a capstone generation did not complete: ${code}`);
  }
  await writeFile(outputPath, outcome.rendered_artifact.html, { encoding: "utf8" });
} finally {
  await rm(dbRootDir, { recursive: true, force: true });
}
