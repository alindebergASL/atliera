import type { H2CapabilityDescriptor } from "./h2-registry.ts";

export interface H2McpCallRequest {
  readonly jsonrpc: "2.0";
  readonly id: string;
  readonly method: "tools/call";
  readonly params: {
    readonly name: string;
    readonly arguments: unknown;
  };
}

export interface H2McpCallResponse {
  readonly jsonrpc: "2.0";
  readonly id: string;
  readonly result: {
    readonly structuredContent: unknown;
    readonly isError: false;
  };
}

export interface H2McpInProcessTransport {
  getDescriptorSnapshot(): unknown;
  call(request: H2McpCallRequest): Promise<H2McpCallResponse>;
}

export interface H2EchoValue {
  readonly value: string;
}

export interface H2ValidatedLiveDescriptor {
  readonly descriptor: H2CapabilityDescriptor;
  readonly sha256: string;
}
