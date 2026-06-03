export type RuntimeModelOnlyStreamEvent = Readonly<{
  type?: unknown;
  delta?: unknown;
  item?: unknown;
}>;

export type RuntimeModelOnlyOutputContractResult = Readonly<{
  text: string;
  source: "delta" | "item_done" | "empty";
}>;

export type RuntimeModelOnlyProofOutput = Readonly<{
  excerpts: readonly unknown[];
  claims: readonly unknown[];
  account_objects: readonly unknown[];
}>;

const REQUIRED_TOP_LEVEL_KEYS = ["account_objects", "claims", "excerpts"] as const;

function ownEnumerableKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (Object.getPrototypeOf(value) !== Object.prototype) return undefined;
  return value as Record<string, unknown>;
}

function extractItemDoneText(item: unknown): string[] {
  const record = asRecord(item);
  if (!record) return [];
  const content = record.content;
  if (!Array.isArray(content)) return [];
  const text: string[] = [];
  for (const entry of content) {
    const contentRecord = asRecord(entry);
    if (!contentRecord) continue;
    const type = contentRecord.type;
    const value = contentRecord.text;
    if ((type === "output_text" || type === "text") && typeof value === "string") {
      text.push(value);
    }
  }
  return text;
}

export function collectRuntimeModelOnlyStreamText(
  events: readonly RuntimeModelOnlyStreamEvent[],
): RuntimeModelOnlyOutputContractResult {
  const deltas: string[] = [];
  const itemDoneTexts: string[] = [];

  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      deltas.push(event.delta);
      continue;
    }
    if (event.type === "response.output_item.done") {
      itemDoneTexts.push(...extractItemDoneText(event.item));
    }
  }

  if (deltas.length > 0) {
    return Object.freeze({ text: deltas.join(""), source: "delta" });
  }
  if (itemDoneTexts.length > 0) {
    return Object.freeze({ text: itemDoneTexts.join(""), source: "item_done" });
  }
  return Object.freeze({ text: "", source: "empty" });
}

export function parseRuntimeModelOnlyProofOutput(text: string): RuntimeModelOnlyProofOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new Error("runtime_model_only_output_not_strict_json");
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new Error("runtime_model_only_output_not_plain_object");
  }

  const keys = ownEnumerableKeys(record);
  if (keys.length !== REQUIRED_TOP_LEVEL_KEYS.length || keys.some((key, index) => key !== REQUIRED_TOP_LEVEL_KEYS[index])) {
    throw new Error("runtime_model_only_output_top_level_key_mismatch");
  }

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!Array.isArray(record[key])) {
      throw new Error("runtime_model_only_output_value_not_array");
    }
  }

  return Object.freeze({
    excerpts: Object.freeze([...(record.excerpts as unknown[])]),
    claims: Object.freeze([...(record.claims as unknown[])]),
    account_objects: Object.freeze([...(record.account_objects as unknown[])]),
  });
}
