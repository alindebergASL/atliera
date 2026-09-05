import assert from "node:assert/strict";
import { access, mkdtemp, symlink, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadC3RecordedReplay, main } from "../../src/c3/cli.ts";
import { loadC3AccountContext } from "../../src/c3/context.ts";
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord } from "../../src/c3/draft.ts";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

async function recordingPackage(root: string) {
  const context = await loadC3AccountContext({
    broadInputPath: resolve(repo, "fixtures/account-intelligence/c2-01/broad-account-research-input.json"),
    proposalPath: resolve(repo, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json"),
    ownerDecisionPath: resolve(repo, "docs/decisions/c2-owner-disposition-record.json"), accountId: "acc_university_of_utah",
  });
  const meetingRequest = { audience: "CIO and engineering leaders", intendedOutcome: "Understand priorities and agree a useful next step",
    durationMinutes: 15 as const, meetingDate: "2026-09-12" };
  const evidence = context.context.admittedSources[0]!.excerpts[0]!.evidenceId;
  const raw = JSON.stringify({ temporalOutcome: "no_material_change_established",
    objective: { text: "Learn current priorities and agree a useful follow-up.", evidenceRefs: [], supportCategory: "recommendation" },
    audienceThesis: { text: "The source context suggests a focused learning agenda may be useful.", evidenceRefs: [evidence], supportCategory: "cautious_inference" },
    opening: { text: "Validate the audience's priorities before proposing a plan.", evidenceRefs: [], supportCategory: "recommendation" },
    questions: [
      { question: "What matters most now?", intendedLearning: "Priority order.", evidenceRefs: [], supportCategory: "open_question" },
      { question: "What constraints matter?", intendedLearning: "Relevant constraints.", evidenceRefs: [evidence], supportCategory: "open_question" },
      { question: "What follow-up helps?", intendedLearning: "A useful next step.", evidenceRefs: [], supportCategory: "open_question" },
    ], risksUnknowns: [{ text: "Current audience priorities remain unknown.", evidenceRefs: [], supportCategory: "unknown" }],
    closeCriterion: { text: "Agree whether and how to continue.", evidenceRefs: [], supportCategory: "recommendation" }, selectedEvidenceRefs: [evidence] });
  const priorRequest = createC3ModelRequest(context, meetingRequest);
  const priorRecord = createGenerationRecord(priorRequest, raw, context);
  assert.equal(priorRecord.outcome, "succeeded");
  const correctionNote = "Use the exact recorded correction and preserve the prior draft identity.";
  const revisionRequest = createC3ModelRequest(context, meetingRequest, createC3RevisionContext(priorRecord, correctionNote, 1));
  const revisionRecord = createGenerationRecord(revisionRequest, raw, context);
  assert.equal(revisionRecord.outcome, "succeeded");
  for (const [name, request] of [["prior", priorRequest], ["revision", revisionRequest]] as const) {
    const directory = resolve(root, name);
    await mkdir(directory);
    await writeFile(resolve(directory, "model-request.json"), `${JSON.stringify(request, null, 2)}\n`);
    await writeFile(resolve(directory, "raw-response.txt"), raw);
  }
  return { context, priorRequest, priorRecord, revisionRecord, correctionNote };
}

test("C3 CLI refuses an ordinary dot-prefixed child inside the repository", async () => {
  const output = resolve(repo, "..c3-cli-regression-output");
  await assert.rejects(() => access(output), absent);
  await assert.rejects(() => main(["load-context", "acc_university_of_utah", output]), /outside the repository/u);
  await assert.rejects(() => access(output), absent);
});

test("C3 CLI refuses canonical output ancestors that point inside the repository", async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), "c3-cli-canonical-"));
  const outputName = "..c3-canonical-regression-output";
  try {
    await symlink(repo, resolve(scratch, "repo-link"));
    await assert.rejects(() => main(["load-context", "acc_university_of_utah", resolve(scratch, "repo-link", outputName)]), /outside the repository/u);
    await assert.rejects(() => access(resolve(repo, outputName)), absent);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});

test("C3 CLI preflights nonempty outputs and never follows an output-file symlink", async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), "c3-cli-output-"));
  try {
    const output = resolve(scratch, "output");
    await mkdir(output);
    const sentinel = resolve(scratch, "sentinel");
    await writeFile(sentinel, "unchanged");
    await symlink(sentinel, resolve(output, "account-context.json"));
    await assert.rejects(() => main(["load-context", "acc_university_of_utah", output]), /must be empty/u);
    assert.equal(await readFile(sentinel, "utf8"), "unchanged");
    await assert.rejects(() => access(resolve(output, "account-context-identity.json")), absent);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});

test("C3 CLI replay refuses invalid UTF-8 and preserves a BOM-bearing raw response", async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), "c3-cli-raw-"));
  try {
    const requestDir = resolve(scratch, "request");
    await main(["emit-model-request", "acc_university_of_utah", "CISO", "Learn current priorities", "2026-09-12", requestDir]);
    const rawPath = resolve(scratch, "raw.txt");
    await writeFile(rawPath, Buffer.from([0x7b, 0xff, 0x7d]));
    await assert.rejects(() => main(["render-recorded-draft", "acc_university_of_utah", resolve(requestDir, "model-request.json"), rawPath, resolve(scratch, "invalid")]), /encoded data|encoding/iu);
    await assert.rejects(() => access(resolve(scratch, "invalid")), absent);
    const bomRaw = Buffer.from("\ufeff{}", "utf8");
    await writeFile(rawPath, bomRaw);
    const replayDir = resolve(scratch, "bom-replay");
    await main(["render-recorded-draft", "acc_university_of_utah", resolve(requestDir, "model-request.json"), rawPath, replayDir]);
    const record = JSON.parse(await readFile(resolve(replayDir, "generation-record.json"), "utf8"));
    assert.equal(record.outcome, "refused");
    assert.equal(record.rawResponse, bomRaw.toString("utf8"));
    assert.equal(record.rawResponseSha256, createHash("sha256").update(bomRaw).digest("hex"));
  } finally { await rm(scratch, { recursive: true, force: true }); }
});

test("serve-recorded preflight validates and links both recordings before binding, independent of C3_MODEL_COMMAND", async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), "c3-recorded-serve-"));
  const priorCommand = process.env.C3_MODEL_COMMAND;
  try {
    const expected = await recordingPackage(scratch);
    process.env.C3_MODEL_COMMAND = "/must/not/be/invoked/by/recorded/replay";
    const replay = await loadC3RecordedReplay(expected.context, scratch);
    assert.equal(replay.provider.name, "recorded-replay");
    assert.deepEqual(replay.initialRequest, expected.priorRequest.meetingRequest);
    assert.equal(replay.correctionNote, expected.correctionNote);
    assert.equal(replay.priorRecord.recordId, expected.priorRecord.recordId);
    assert.equal(replay.revisionRecord.recordId, expected.revisionRecord.recordId);

    const controller = new AbortController();
    assert.equal(await replay.provider.generate(expected.priorRequest, controller.signal), expected.priorRecord.rawResponse);
    await assert.rejects(() => replay.provider.generate(createC3ModelRequest(expected.context,
      { ...expected.priorRequest.meetingRequest, audience: "CISO" }), controller.signal),
    /no response matches this exact request.*no live generation was attempted/iu);

    const revisionPath = resolve(scratch, "revision", "model-request.json");
    const edited = JSON.parse(await readFile(revisionPath, "utf8"));
    edited.revision.priorRecordId = "c3_000000000000000000000000";
    await writeFile(revisionPath, `${JSON.stringify(edited, null, 2)}\n`);
    await assert.rejects(() => loadC3RecordedReplay(expected.context, scratch), /identity or prompt mismatch|does not exactly bind/u);
  } finally {
    priorCommand === undefined ? delete process.env.C3_MODEL_COMMAND : process.env.C3_MODEL_COMMAND = priorCommand;
    await rm(scratch, { recursive: true, force: true });
  }
});

test("serve-recorded preflight refuses corrupt raw response instead of binding a refusal-only preview", async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), "c3-recorded-corrupt-"));
  try {
    const expected = await recordingPackage(scratch);
    await writeFile(resolve(scratch, "prior", "raw-response.txt"), "not json");
    await assert.rejects(() => loadC3RecordedReplay(expected.context, scratch), /prior recorded candidate refused without repair/u);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
