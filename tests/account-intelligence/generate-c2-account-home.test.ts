import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  generateFreshUtahC2AccountHome,
  preflightFreshC2AccountHomeOutput,
} from "../../src/cli/generate-c2-account-home.ts";

test("CLI generator re-admits the broad Utah run and writes source-derived review output", async () => {
  const output = await mkdtemp(join(tmpdir(), "atliera-c2-render-"));
  const receipt = await generateFreshUtahC2AccountHome(output);
  assert.equal(receipt.accountId, "acc_university_of_utah");
  assert.equal(receipt.admittedSources, 10);
  assert.equal(receipt.admittedExcerpts, 33);
  assert.equal(receipt.discoveryRecords, 35);
  assert.equal(receipt.rendererAnnotations, 4);
  assert.equal(receipt.providerCallsDuringGeneration, 0);
  assert.equal(receipt.ratificationCreated, false);

  const html = await readFile(join(output, "university-of-utah.html"), "utf8");
  assert.match(html, /University of Utah/u);
  assert.match(html, /Redtail/u);
  assert.match(html, /Utah Health AI Vault/u);
  assert.match(html, /table row captured without its column headers/u);
  assert.match(html, /recheck it before meeting use/u);
  assert.match(html, /Related evidence context 1/u);
  assert.match(html, /Exact support 1/u);
  assert.match(html, /Quoted exactly · University of Utah Communications \/ @theU/u);
  assert.doesNotMatch(html, /owner (?:approved|reviewed|said)/iu);

  const generatedResult = JSON.parse(await readFile(join(output, "university-of-utah-validated-result.json"), "utf8"));
  assert.equal(generatedResult.admittedSources.length, 10);
  assert.equal(generatedResult.admittedSources.flatMap((source: { excerpts: unknown[] }) => source.excerpts).length, 33);
  assert.equal(generatedResult.discoveries.length, 35);
  assert.equal(generatedResult.effectReceipt.providerCallsAttempted, 1, "historical effect receipt remains historical");
  assert.equal(receipt.providerCallsDuringGeneration, 0, "this renderer run makes no provider call");

  const beforeRepeat = await readFile(join(output, "university-of-utah.html"), "utf8");
  await assert.rejects(() => generateFreshUtahC2AccountHome(output), /fresh output directory|already exists/u);
  assert.equal(await readFile(join(output, "university-of-utah.html"), "utf8"), beforeRepeat);
});

test("CLI generator refuses the frozen historical output directory", async () => {
  await assert.rejects(
    () => generateFreshUtahC2AccountHome(join(process.cwd(), "docs/ux/c2-governed-account-intelligence-refresh")),
    /outside the frozen C2 history/u,
  );
});

test("CLI generator refuses an output-directory symlink without changing sentinel bytes", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "atliera-c2-directory-symlink-"));
  const target = join(fixture, "target");
  await mkdir(target);
  const sentinel = join(target, "university-of-utah.html");
  await writeFile(sentinel, "directory-symlink-sentinel\n", "utf8");
  const output = join(fixture, "output-link");
  await symlink(target, output, "dir");

  await assert.rejects(() => generateFreshUtahC2AccountHome(output), /symbolic link|fresh output directory/u);
  assert.equal(await readFile(sentinel, "utf8"), "directory-symlink-sentinel\n");
});

test("CLI generator refuses an existing output-file symlink without changing sentinel bytes", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "atliera-c2-file-symlink-"));
  const output = join(fixture, "output");
  await mkdir(output);
  const sentinel = join(fixture, "sentinel.html");
  await writeFile(sentinel, "file-symlink-sentinel\n", "utf8");
  await symlink(sentinel, join(output, "university-of-utah.html"), "file");

  await assert.rejects(() => generateFreshUtahC2AccountHome(output), /fresh output directory|already exists|symbolic link/u);
  assert.equal(await readFile(sentinel, "utf8"), "file-symlink-sentinel\n");
});

test("output preflight resolves the nearest existing ancestor in a disposable protected fixture", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "atliera-c2-canonical-ancestor-"));
  const protectedRoot = join(fixture, "frozen-copy");
  await mkdir(protectedRoot);
  const sentinel = join(protectedRoot, "sentinel.txt");
  await writeFile(sentinel, "canonical-ancestor-sentinel\n", "utf8");
  const alias = join(fixture, "alias");
  await symlink(protectedRoot, alias, "dir");

  await assert.rejects(
    () => preflightFreshC2AccountHomeOutput(join(alias, "not-created"), protectedRoot),
    /resolves inside the frozen C2 history/u,
  );
  assert.equal(await readFile(sentinel, "utf8"), "canonical-ancestor-sentinel\n");
});

test("protected children beginning with two dots are not parent traversal", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "atliera-c2-dot-child-"));
  const protectedRoot = join(fixture, "frozen-copy");
  const child = join(protectedRoot, "..ordinary-child");
  await mkdir(child, { recursive: true });
  const alias = join(fixture, "ancestor-alias");
  await symlink(child, alias, "dir");
  await assert.rejects(() => preflightFreshC2AccountHomeOutput(join(alias, "new-output"), protectedRoot),
    /resolves inside the frozen C2 history/u);
  await assert.rejects(() => readFile(join(child, "new-output", "university-of-utah.html")),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT");
});
