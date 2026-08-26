import { types as nodeUtilTypes } from "node:util";
import type {
  HermesGpt55InjectedStreamCaller,
  HermesGpt55ModelOnlyProviderPayload,
  HermesGpt55StreamingEvent,
} from "../model/hermes-gpt55-model-only-transport-proof.ts";

export const C2_HERMES_GPT55_LOCAL_STREAM_CAPTURE_MAX_UTF8_BYTES = 512_000 as const;

function ownEnumerableDataDescriptor(value: object, key: PropertyKey, path: string): PropertyDescriptor {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new Error(`${path} own-data descriptor unavailable`);
  }
  if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
    throw new Error(`${path} must be enumerable own-data`);
  }
  return descriptor;
}

function ownDataFunction(value: object, key: string): ((...args: never[]) => unknown) {
  const descriptor = ownEnumerableDataDescriptor(value, key, `C2 stream dependency.${key}`);
  if (typeof descriptor.value !== "function") {
    throw new Error("C2 stream dependency must expose an enumerable own-data function");
  }
  return descriptor.value as (...args: never[]) => unknown;
}

function snapshotEvent(value: unknown): HermesGpt55StreamingEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value) || nodeUtilTypes.isProxy(value)) {
    throw new Error("C2 stream event must be a non-Proxy plain object");
  }
  let prototype: object | null;
  let names: string[];
  let symbols: symbol[];
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    names = Object.getOwnPropertyNames(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    throw new Error("C2 stream event descriptors unavailable");
  }
  if (prototype !== Object.prototype || symbols.length !== 0) {
    throw new Error("C2 stream event must use Object.prototype and no symbol keys");
  }
  const typeDescriptor = ownEnumerableDataDescriptor(value, "type", "C2 stream event.type");
  const type = typeDescriptor.value;
  if (type === "response.output_text.delta") {
    if (names.length !== 2 || !names.includes("delta")) {
      throw new Error("C2 stream delta fields must exactly match the contract");
    }
    const deltaDescriptor = ownEnumerableDataDescriptor(value, "delta", "C2 stream event.delta");
    if (typeof deltaDescriptor.value !== "string") {
      throw new Error("C2 stream event.delta must be string own-data");
    }
    return Object.freeze({ type, delta: deltaDescriptor.value });
  }
  if (type === "response.completed" || type === "response.failed" || type === "response.incomplete") {
    if (names.length !== 1) throw new Error("C2 terminal event fields must exactly match the contract");
    return Object.freeze({ type });
  }
  throw new Error("C2 stream event type refused");
}

/**
 * C2-local stream wrapper for the established Hermes GPT-5.5 adapter seam.
 * The reviewed transport contract does not transmit a server output-token
 * ceiling, so this wrapper bounds local UTF-8 capture before the shared
 * adapter concatenates and parses streamed text. Abrupt failure closes the
 * upstream async iterator through AsyncIteratorClose. Reported token usage
 * remains subject to AccountIntelligenceProviderBoundary's local ceiling.
 */
export function createC2BoundedHermesGpt55StreamCaller(
  delegate: HermesGpt55InjectedStreamCaller,
): HermesGpt55InjectedStreamCaller {
  if (typeof delegate !== "object" || delegate === null || nodeUtilTypes.isProxy(delegate)) {
    throw new Error("C2 stream dependency refused");
  }
  const stream = ownDataFunction(delegate, "stream").bind(delegate) as (
    payload: HermesGpt55ModelOnlyProviderPayload,
  ) => AsyncIterable<HermesGpt55StreamingEvent>;
  return Object.freeze({
    kind: "injected-stream-caller" as const,
    async *stream(payload: HermesGpt55ModelOnlyProviderPayload): AsyncIterable<HermesGpt55StreamingEvent> {
      const events = stream(payload);
      if (typeof events !== "object" || events === null) {
        throw new Error("C2 stream dependency must return an async event stream");
      }
      let capturedUtf8Bytes = 0;
      for await (const rawEvent of events) {
        const event = snapshotEvent(rawEvent);
        if (event.type === "response.output_text.delta") {
          const chunkBytes = Buffer.byteLength(event.delta, "utf8");
          if (chunkBytes > C2_HERMES_GPT55_LOCAL_STREAM_CAPTURE_MAX_UTF8_BYTES - capturedUtf8Bytes) {
            throw new Error("C2 local stream capture limit exceeded");
          }
          capturedUtf8Bytes += chunkBytes;
        }
        yield event;
      }
    },
  });
}
