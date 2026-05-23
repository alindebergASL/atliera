import { FakeModelAdapter, type ModelAdapter } from "../agent/model-adapter.ts";
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

export interface AtlieraRuntime {
  readonly config: AtlieraRuntimeConfig;
  readonly graphStore: GraphStore;
  readonly artifactStore: ArtifactStore;
  readonly jobQueue: JobQueue;
  readonly modelAdapter: ModelAdapter;
}

export interface AtlieraRuntimeDependencies {
  readonly config: AtlieraRuntimeConfig;
  readonly graphStore: GraphStore;
  readonly artifactStore: ArtifactStore;
  readonly jobQueue: JobQueue;
  readonly modelAdapter: ModelAdapter;
}

export function createAtlieraRuntime(
  dependencies: AtlieraRuntimeDependencies,
): AtlieraRuntime {
  return {
    config: dependencies.config,
    graphStore: dependencies.graphStore,
    artifactStore: dependencies.artifactStore,
    jobQueue: dependencies.jobQueue,
    modelAdapter: dependencies.modelAdapter,
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
