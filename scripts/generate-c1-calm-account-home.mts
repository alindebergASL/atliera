import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prepareC1SyntheticScenario } from "../tests/fixtures/c1-calm-account-home.ts";

const root = await mkdtemp(join(tmpdir(), "atliera-c1-calm-account-home-generator-"));
try {
  const prepared = await prepareC1SyntheticScenario(root, { withMeetingPlan: false });
  await writeFile(
    join(process.cwd(), "fixtures/workshop/c1-calm-account-home.html"),
    prepared.artifact.html,
    { encoding: "utf8" },
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
