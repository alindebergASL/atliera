#!/usr/bin/env node
import { buildProductPreviewDryRunPlan } from "../product-preview/sanitized-runtime-status.ts";

function usage(): never {
  console.error(`Usage: tsx src/cli/product-preview-plan.ts plan \\
  --job-id <id> \\
  --approval-ref <doc> \\
  --route-ref <route> \\
  --provider-ref <provider> \\
  --model-label <model> \\
  --transport-kind <transport> \\
  --corpus-ref <corpus> \\
  --prompt-contract-ref <prompt> \\
  --max-provider-calls <n> \\
  --max-cost-usd <n> \\
  --slot-roles <role,role> \\
  --runtime-mode <model-only-smoke|product-preview-expansion>`);
  process.exit(2);
}

function parseArgs(argv: readonly string[]): Record<string, string> {
  if (argv[0] !== "plan") usage();
  const out: Record<string, string> = {};
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !flag.startsWith("--") || value === undefined || value.startsWith("--")) usage();
    const key = flag.slice(2).replaceAll("-", "_");
    if (Object.prototype.hasOwnProperty.call(out, key)) usage();
    out[key] = value;
  }
  return out;
}

function required(args: Record<string, string>, key: string): string {
  const value = args[key];
  if (!value) usage();
  return value;
}

function numberArg(args: Record<string, string>, key: string): number {
  const raw = required(args, key);
  const value = Number(raw);
  if (!Number.isFinite(value)) usage();
  return value;
}

const args = parseArgs(process.argv.slice(2));
const runtimeMode = required(args, "runtime_mode");
if (runtimeMode !== "model-only-smoke" && runtimeMode !== "product-preview-expansion") usage();
const slotRoles = required(args, "slot_roles").split(",").filter(Boolean);
const plan = buildProductPreviewDryRunPlan({
  job_id: required(args, "job_id"),
  approval_ref: required(args, "approval_ref"),
  route_ref: required(args, "route_ref"),
  provider_ref: required(args, "provider_ref"),
  model_label: required(args, "model_label"),
  transport_kind: required(args, "transport_kind"),
  corpus_ref: required(args, "corpus_ref"),
  prompt_contract_ref: required(args, "prompt_contract_ref"),
  max_provider_calls: numberArg(args, "max_provider_calls"),
  max_cost_usd: numberArg(args, "max_cost_usd"),
  slot_roles: slotRoles,
  runtime_mode: runtimeMode,
});
console.log(JSON.stringify(plan, null, 2));
