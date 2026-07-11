export type H2McpRequestId = string | number;

export interface H2McpInitializeRequest {
  readonly jsonrpc: "2.0";
  readonly id: H2McpRequestId;
  readonly method: "initialize";
  readonly params: {
    readonly protocolVersion: string;
    readonly capabilities: Record<string, never>;
    readonly clientInfo: {
      readonly name: string;
      readonly version: string;
    };
  };
}

export interface H2McpListToolsRequest {
  readonly jsonrpc: "2.0";
  readonly id: H2McpRequestId;
  readonly method: "tools/list";
}

export interface H2McpCallRequest {
  readonly jsonrpc: "2.0";
  readonly id: H2McpRequestId;
  readonly method: "tools/call";
  readonly params: {
    readonly name: string;
    readonly arguments: unknown;
  };
}

export type H2McpRequest =
  | H2McpInitializeRequest
  | H2McpListToolsRequest
  | H2McpCallRequest;

export interface H2McpInitializedNotification {
  readonly jsonrpc: "2.0";
  readonly method: "notifications/initialized";
}

export interface H2McpCancelledNotification {
  readonly jsonrpc: "2.0";
  readonly method: "notifications/cancelled";
  readonly params: {
    readonly requestId: H2McpRequestId;
    readonly reason: "request deadline exceeded";
  };
}

export type H2McpNotification =
  | H2McpInitializedNotification
  | H2McpCancelledNotification;

export interface H2McpResponse {
  readonly jsonrpc: "2.0";
  readonly id: H2McpRequestId;
  readonly result: unknown;
}

export interface H2McpRequestOptions {
  readonly signal?: AbortSignal;
}

export interface H2McpInProcessTransport {
  sendRequest(request: H2McpRequest, options?: H2McpRequestOptions): Promise<H2McpResponse>;
  sendNotification(notification: H2McpNotification): Promise<void>;
}

export interface H2EchoValue {
  readonly value: string;
}
