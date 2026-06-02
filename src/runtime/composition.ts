import { FakeModelAdapter, type ModelAdapter } from "../agent/model-adapter.ts";
import type { ModelProvider } from "../model/provider.ts";
import type { SelectedModelRoute } from "../model/validated-route-catalog.ts";
import {
  InMemoryArtifactStore,
  type ArtifactStore,
} from "../artifacts/store.ts";
import {
  parseAtlieraRuntimeConfig,
  type AtlieraRuntimeConfig,
  type RuntimeConfigEnv,
} from "../config/runtime.ts";
import { InMemoryGraphStore, type GraphStore } from "../graph/store.ts";
import { InMemoryJobQueue, type JobQueue } from "../jobs/queue.ts";

export interface AtlieraSelectedModelRouteSummary {
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly routeKind: SelectedModelRoute["route"]["routeKind"];
  readonly selectionReason: SelectedModelRoute["selectionReason"];
  readonly approvalRef: string | null;
  readonly validationAgeDays: number;
  readonly defaultModelSelectionClaim: false;
  readonly providerLockIn: false;
  readonly runtimeModelModeIntegration: false;
  readonly providerCallsExecuted: 0;
}

export interface AtlieraRuntime {
  readonly config: AtlieraRuntimeConfig;
  readonly graphStore: GraphStore;
  readonly artifactStore: ArtifactStore;
  readonly jobQueue: JobQueue;
  readonly modelAdapter: ModelAdapter;
  readonly modelProvider?: ModelProvider;
  readonly selectedModelRoute?: AtlieraSelectedModelRouteSummary;
}

export interface AtlieraRuntimeDependencies {
  readonly config: AtlieraRuntimeConfig;
  readonly graphStore: GraphStore;
  readonly artifactStore: ArtifactStore;
  readonly jobQueue: JobQueue;
  readonly modelAdapter: ModelAdapter;
  readonly modelProvider?: ModelProvider;
  readonly selectedModelRoute?: SelectedModelRoute;
}

function summarizeSelectedModelRoute(route: SelectedModelRoute): AtlieraSelectedModelRouteSummary {
  return Object.freeze({
    routeRef: route.route.routeRef,
    providerRef: route.route.providerRef,
    modelLabel: route.route.modelLabel,
    routeKind: route.route.routeKind,
    selectionReason: route.selectionReason,
    approvalRef: route.approvalRef,
    validationAgeDays: route.validationAgeDays,
    defaultModelSelectionClaim: false,
    providerLockIn: false,
    runtimeModelModeIntegration: false,
    providerCallsExecuted: 0,
  });
}

export function createAtlieraRuntime(
  dependencies: AtlieraRuntimeDependencies,
): AtlieraRuntime {
  const productionLike = dependencies.config.environment === "production" || dependencies.config.environment === "staging";
  if (productionLike && dependencies.selectedModelRoute?.route.routeKind === "fake") {
    throw new Error("fake model routes are not allowed for production-like runtime binding");
  }

  return {
    config: dependencies.config,
    graphStore: dependencies.graphStore,
    artifactStore: dependencies.artifactStore,
    jobQueue: dependencies.jobQueue,
    modelAdapter: dependencies.modelAdapter,
    ...(dependencies.modelProvider ? { modelProvider: dependencies.modelProvider } : {}),
    ...(dependencies.selectedModelRoute ? { selectedModelRoute: summarizeSelectedModelRoute(dependencies.selectedModelRoute) } : {}),
  };
}

export function createInMemoryAtlieraRuntime(
  env: RuntimeConfigEnv = {},
): AtlieraRuntime {
  const config = parseAtlieraRuntimeConfig(env);
  if (config.environment === "production" || config.environment === "staging") {
    throw new Error(
      "in-memory runtime is only allowed for development, test, or lab environments",
    );
  }

  return createAtlieraRuntime({
    config,
    graphStore: new InMemoryGraphStore(),
    artifactStore: new InMemoryArtifactStore(),
    jobQueue: new InMemoryJobQueue(),
    modelAdapter: new FakeModelAdapter(),
  });
}
