import assert from "node:assert/strict";
import test from "node:test";

import {
  C2_HERMES_GPT55_LOCAL_STREAM_CAPTURE_MAX_UTF8_BYTES,
  createC2BoundedHermesGpt55StreamCaller,
} from "../../src/account-intelligence/hermes-gpt55-c2-stream-boundary.ts";
import {
  createHermesGpt55ModelOnlyRequestPlan,
  HermesGpt55StreamingModelProvider,
  type HermesGpt55InjectedStreamCaller,
  type HermesGpt55StreamingEvent,
} from "../../src/model/hermes-gpt55-model-only-transport-proof.ts";
import { createModelProviderRequest } from "../../src/model/provider.ts";

function request() {
  return createModelProviderRequest({
    operation: "graph.propose",
    mode: "model",
    model: "gpt-5.5",
    prompt: "Return the controlled C2 fixture response.",
    inputGraphRef: "external-corpus/c2/alignment-fixture",
    idempotencyKey: "c2-stream-boundary-fixture",
    maxOutputTokens: 4_096,
    temperature: 0,
    metadata: {},
  });
}

function validResponseJson(): string {
  return JSON.stringify({
    provider: "hermes-gpt55-streaming-adapter",
    model: "gpt-5.5",
    idempotencyKey: request().idempotencyKey,
    output: { excerpts: [], claims: [], account_objects: [] },
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    cost: { currency: "USD", amount: 0 },
  });
}

function caller(factory: () => AsyncIterable<HermesGpt55StreamingEvent>): HermesGpt55InjectedStreamCaller {
  return { kind: "injected-stream-caller", stream: factory };
}

async function collect(c: HermesGpt55InjectedStreamCaller): Promise<HermesGpt55StreamingEvent[]> {
  const payload = createHermesGpt55ModelOnlyRequestPlan(request()).provider_payload;
  const events: HermesGpt55StreamingEvent[] = [];
  for await (const event of c.stream(payload)) events.push(event);
  return events;
}

test("C2 stream boundary counts raw UTF-8 bytes and permits the exact multibyte ceiling", async () => {
  const exact = "é".repeat(C2_HERMES_GPT55_LOCAL_STREAM_CAPTURE_MAX_UTF8_BYTES / 2);
  assert.equal(Buffer.byteLength(exact, "utf8"), C2_HERMES_GPT55_LOCAL_STREAM_CAPTURE_MAX_UTF8_BYTES);
  const events = await collect(createC2BoundedHermesGpt55StreamCaller(caller(async function* () {
    yield { type: "response.output_text.delta", delta: exact };
    yield { type: "response.completed" };
  })));
  assert.equal(events.length, 2);
});

test("C2 stream boundary aborts upstream immediately on UTF-8 overrun", async () => {
  let cancelled = false;
  let reachedAfterOverrun = false;
  const bounded = createC2BoundedHermesGpt55StreamCaller(caller(async function* () {
    try {
      yield {
        type: "response.output_text.delta",
        delta: "é".repeat(C2_HERMES_GPT55_LOCAL_STREAM_CAPTURE_MAX_UTF8_BYTES / 2),
      };
      yield { type: "response.output_text.delta", delta: "x" };
      reachedAfterOverrun = true;
      yield { type: "response.completed" };
    } finally {
      cancelled = true;
    }
  }));
  await assert.rejects(() => collect(bounded), /local stream capture limit exceeded/u);
  assert.equal(cancelled, true);
  assert.equal(reachedAfterOverrun, false);
});

test("C2 stream boundary rejects event accessors, symbol keys, and unexpected prototypes without invocation", async () => {
  let getterReads = 0;
  const accessorEvent: Record<string, unknown> = { type: "response.output_text.delta" };
  Object.defineProperty(accessorEvent, "delta", {
    enumerable: true,
    get() {
      getterReads += 1;
      return "{}";
    },
  });
  await assert.rejects(
    () => collect(createC2BoundedHermesGpt55StreamCaller(caller(async function* () {
      yield accessorEvent as never;
    }))),
    /own-data/u,
  );
  assert.equal(getterReads, 0);

  const symbolEvent = { type: "response.completed", [Symbol("forged")]: true } as never;
  await assert.rejects(
    () => collect(createC2BoundedHermesGpt55StreamCaller(caller(async function* () { yield symbolEvent; }))),
    /symbol keys/u,
  );

  const prototypeEvent = Object.create({ forged: true }) as Record<string, unknown>;
  Object.defineProperty(prototypeEvent, "type", {
    enumerable: true,
    value: "response.completed",
  });
  await assert.rejects(
    () => collect(createC2BoundedHermesGpt55StreamCaller(caller(async function* () {
      yield prototypeEvent as never;
    }))),
    /Object\.prototype/u,
  );
});

test("C2-bounded adapter rejects incomplete, trailing, and concatenated JSON", async () => {
  const valid = validResponseJson();
  for (const raw of [valid.slice(0, -1), `${valid} trailing`, `${valid}${valid}`]) {
    const adapter = new HermesGpt55StreamingModelProvider({
      streamCaller: createC2BoundedHermesGpt55StreamCaller(caller(async function* () {
        yield { type: "response.output_text.delta", delta: raw };
        yield { type: "response.completed" };
      })),
    });
    await assert.rejects(() => adapter.generate(request()), /invalid Hermes GPT-5\.5 streaming response/u);
  }
});

test("C2-bounded adapter accepts exactly one complete JSON value within the local byte bound", async () => {
  const adapter = new HermesGpt55StreamingModelProvider({
    streamCaller: createC2BoundedHermesGpt55StreamCaller(caller(async function* () {
      const raw = validResponseJson();
      yield { type: "response.output_text.delta", delta: raw.slice(0, 20) };
      yield { type: "response.output_text.delta", delta: raw.slice(20) };
      yield { type: "response.completed" };
    })),
  });
  const response = await adapter.generate(request());
  assert.equal(response.provider, "hermes-gpt55-streaming-adapter");
  assert.equal(response.usage.outputTokens, 0);
});
