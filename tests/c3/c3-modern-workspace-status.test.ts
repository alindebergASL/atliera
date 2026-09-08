import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("modern workspace status distinguishes durable local work, replay and blocked fresh generation", async () => {
  const status = await readFile("docs/status/modern-workspace-v2-20260908.md", "utf8");
  const readme = await readFile("README.md", "utf8");
  assert.ok(readme.includes("docs/status/modern-workspace-v2-20260908.md"));
  for (const text of [
    "Overview / Research / Workshop",
    "Blocked; zero product inference calls.",
    "Actual historical model-response replay",
    "not a fresh response to arbitrary new input",
    "synchronized persistence and validated readback",
    "after process restart",
    "Only explicit **Apply** changes the working brief",
    "This status selects no new route",
    "not multi-user authentication",
    "not different model families or human approval",
    "OpenRouter is not a product commitment",
    "Anthropic API and OpenAI API",
    "without product-logic rewrites",
  ]) assert.ok(status.includes(text), text);
  assert.doesNotMatch(status, /(?:proves|establishes|claims) (?:production|launch|customer) readiness/iu);
});
