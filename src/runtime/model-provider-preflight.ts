import {
  evaluateModelActivationGates,
  type ModelActivationGateInput,
} from "../model/activation-gates.ts";
import { defineResourcePreflightCheck, type ResourcePreflightCheckDefinition } from "./resource-preflight.ts";

export type ModelProviderCredentialStatus = "present" | "missing" | "invalid";

export interface ModelProviderCredentialCheckResult {
  readonly status: ModelProviderCredentialStatus;
}

export interface ModelProviderCredentialCheckDefinition {
  readonly name: string;
  readonly check: () => ModelProviderCredentialCheckResult | Promise<ModelProviderCredentialCheckResult>;
}

export interface ModelProviderActivationPreflightInput {
  readonly activation: ModelActivationGateInput;
  readonly credential: ModelProviderCredentialCheckDefinition;
  readonly name?: string;
}

const SAFE_CREDENTIAL_NAME = /^[A-Z][A-Z0-9_]{0,127}$/;

export function defineModelProviderActivationPreflightCheck(
  input: ModelProviderActivationPreflightInput,
): ResourcePreflightCheckDefinition {
  assertSafeCredentialName(input.credential.name);

  return defineResourcePreflightCheck({
    target: "model_provider",
    name: input.name ?? "model provider activation probe",
    run: async () => {
      const decision = evaluateModelActivationGates(input.activation);
      const baseMetadata = {
        adapter: "model_provider",
        probe: "activation",
        provider: input.activation.provider,
        model: input.activation.model,
      };

      if (!decision.ok) {
        return {
          status: "fail",
          code: "model_activation_refused",
          message: "model provider activation gates refused",
          metadata: {
            ...baseMetadata,
            missing_gate_count: decision.missing_gates.length,
            refusal_reason_count: decision.refusal_reasons.length,
            observed_spend_usd: decision.observed_spend_usd,
            next_estimated_cost_usd: decision.next_estimated_cost_usd,
          },
        };
      }

      let credential: ModelProviderCredentialCheckResult;
      try {
        credential = await input.credential.check();
      } catch {
        return {
          status: "fail",
          code: "model_credential_check_failed",
          message: "model provider credential check failed",
          metadata: baseMetadata,
        };
      }

      assertCredentialStatus(credential.status);
      if (credential.status !== "present") {
        return {
          status: "fail",
          code:
            credential.status === "missing"
              ? "model_credential_missing"
              : "model_credential_invalid",
          message: "model provider credential check failed",
          metadata: baseMetadata,
        };
      }

      return {
        status: "pass",
        code: "model_provider_ready",
        message: "model provider activation probe passed",
        metadata: {
          ...baseMetadata,
          approved_budget_usd: decision.approved_budget_usd ?? 0,
          observed_spend_usd: decision.observed_spend_usd,
          next_estimated_cost_usd: decision.next_estimated_cost_usd,
        },
      };
    },
  });
}

function assertSafeCredentialName(name: string): void {
  if (!SAFE_CREDENTIAL_NAME.test(name)) {
    throw new Error("credential name must be an uppercase logical environment key name");
  }
}

function assertCredentialStatus(status: string): asserts status is ModelProviderCredentialStatus {
  if (status !== "present" && status !== "missing" && status !== "invalid") {
    throw new Error("credential check status is not supported");
  }
}
