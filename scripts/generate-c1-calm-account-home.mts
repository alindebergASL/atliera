import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prepareC1SyntheticScenario } from "../tests/fixtures/c1-calm-account-home.ts";

const root = await mkdtemp(join(tmpdir(), "atliera-c1-calm-account-home-generator-"));
try {
  await Promise.all([
    mkdir(join(root, "no-plan")),
    mkdir(join(root, "plan")),
  ]);
  const [noPlan, plan] = await Promise.all([
    prepareC1SyntheticScenario(join(root, "no-plan"), { withMeetingPlan: false }),
    prepareC1SyntheticScenario(join(root, "plan"), { withMeetingPlan: true }),
  ]);
  await Promise.all([
    writeFile(
      join(process.cwd(), "fixtures/workshop/c1-calm-account-home.html"),
      noPlan.artifact.html,
      { encoding: "utf8" },
    ),
    writeFile(
      join(process.cwd(), "fixtures/workshop/c1-calm-account-home-plan.html"),
      plan.artifact.html,
      { encoding: "utf8" },
    ),
  ]);
} finally {
  await rm(root, { recursive: true, force: true });
}
