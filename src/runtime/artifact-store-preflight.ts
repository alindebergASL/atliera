import { assertSafeArtifactKey, type ArtifactStore } from "../artifacts/store.ts";
import { defineResourcePreflightCheck, type ResourcePreflightCheckDefinition, type ResourcePreflightCheckResult } from "./resource-preflight.ts";

export interface ArtifactStorePreflightCheckOptions {
  store: ArtifactStore;
  probeKey: string;
}

const PROBE_CONTENT = "atliera artifact store preflight probe";
const PROBE_METADATA = { purpose: "resource-preflight" } as const;
const ARTIFACT_STORE_PROBE_METADATA = {
  adapter: "artifact_store",
  probe: "read_write",
} as const;

export function defineArtifactStorePreflightCheck(
  options: ArtifactStorePreflightCheckOptions,
): ResourcePreflightCheckDefinition {
  assertSafeArtifactKey(options.probeKey);

  return defineResourcePreflightCheck({
    target: "artifact_store",
    name: "artifact store read write probe",
    run: async () => runArtifactStoreProbe(options.store, options.probeKey),
  });
}

async function runArtifactStoreProbe(
  store: ArtifactStore,
  probeKey: string,
): Promise<ResourcePreflightCheckResult> {
  try {
    await store.putText(probeKey, PROBE_CONTENT, {
      contentType: "text/plain",
      metadata: { ...PROBE_METADATA },
    });

    const readBack = await store.getText(probeKey);
    if (readBack?.content !== PROBE_CONTENT) {
      return {
        status: "fail",
        code: "artifact_store_mismatch",
        message: "artifact store read write probe returned mismatched content",
        metadata: { ...ARTIFACT_STORE_PROBE_METADATA },
      };
    }

    return {
      status: "pass",
      code: "artifact_store_reachable",
      message: "artifact store read write probe passed",
      metadata: { ...ARTIFACT_STORE_PROBE_METADATA },
    };
  } catch {
    return {
      status: "fail",
      code: "artifact_store_unreachable",
      message: "artifact store read write probe failed",
      metadata: { ...ARTIFACT_STORE_PROBE_METADATA },
    };
  }
}
