// ModelAdapter interface (future-facing) and a deterministic fake.
//
// Phase 1 does not implement real model/provider integration. This file
// only defines the interface and a fake that returns deterministic empty
// proposals. There is no provider SDK import, no API key read, and no
// network call anywhere in this module.

import {
  ModelModeNotActivatedError,
  type RuntimeMode,
} from "../modes/index.ts";

export interface ModelProposal {
  excerpts: never[];
  claims: never[];
  account_objects: never[];
}

export interface ModelAdapter {
  readonly name: string;
  propose(input: { prompt: string; mode: RuntimeMode }): Promise<ModelProposal>;
}

// The fake adapter does no I/O and returns an empty proposal every time.
// It exists so Phase 1 callers (CLI, tests) can wire `propose` calls
// without ever depending on a real provider.
export class FakeModelAdapter implements ModelAdapter {
  readonly name = "fake-deterministic";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async propose(input: {
    prompt: string;
    mode: RuntimeMode;
  }): Promise<ModelProposal> {
    if (input.mode === "model") {
      // The fake is not the real provider. Refuse model mode here too,
      // so an accidental switch to "model" can't smuggle silent empty
      // proposals through.
      throw new ModelModeNotActivatedError(input.mode);
    }
    return { excerpts: [], claims: [], account_objects: [] };
  }
}
