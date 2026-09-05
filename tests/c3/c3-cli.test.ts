import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { main } from "../../src/c3/cli.ts";

test("C3 CLI refuses an ordinary dot-prefixed child inside the repository", async () => {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const output = resolve(repo, "..c3-cli-regression-output");
  const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";
  await assert.rejects(() => access(output), absent);
  await assert.rejects(() => main(["load-context", "acc_university_of_utah", output]), /outside the repository/u);
  await assert.rejects(() => access(output), absent);
});
