import assert from "node:assert/strict";
import { access, mkdtemp, symlink, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { main } from "../../src/c3/cli.ts";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

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
