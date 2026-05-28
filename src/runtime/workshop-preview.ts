import type { WorkshopViewModel } from "../workshop/view-model.ts";
import { renderWorkshopHtml } from "../workshop/render-html.ts";
import { buildWorkshopViewModel } from "../workshop/view-model.ts";
import type { AtlieraRuntime } from "./composition.ts";
import {
  runRuntimePreflight,
  type RuntimePreflightReport,
} from "./preflight.ts";

export type RuntimeWorkshopPreviewKind = "workshop-preview";

export type RuntimeWorkshopPreviewFailureCode =
  | "workshop_preview_requires_fake_model_provider";

export interface RuntimeWorkshopPreviewFailure {
  readonly code: RuntimeWorkshopPreviewFailureCode;
  readonly message: string;
}

export interface RuntimeWorkshopPreviewReport {
  readonly ok: boolean;
  readonly kind: RuntimeWorkshopPreviewKind;
  readonly environment: AtlieraRuntime["config"]["environment"];
  readonly preflight: RuntimePreflightReport;
  readonly previewFailures: readonly RuntimeWorkshopPreviewFailure[];
  readonly viewModel?: WorkshopViewModel;
  readonly graphSnapshotRead: boolean;
  readonly serverStarted: false;
  readonly clientsConstructed: false;
  readonly providerCallsMade: 0;
  readonly productionWrites: false;
}

export interface RuntimeWorkshopHtmlPreviewReport {
  readonly ok: boolean;
  readonly kind: "workshop-html-preview";
  readonly environment: AtlieraRuntime["config"]["environment"];
  readonly workshopPreview: RuntimeWorkshopPreviewReport;
  readonly html?: string;
  readonly htmlRendered: boolean;
  readonly graphSnapshotRead: boolean;
  readonly serverStarted: false;
  readonly clientsConstructed: false;
  readonly providerCallsMade: 0;
  readonly productionWrites: false;
}

function getPreviewFailures(runtime: AtlieraRuntime): RuntimeWorkshopPreviewFailure[] {
  if (runtime.config.modelProvider !== "fake") {
    return [
      {
        code: "workshop_preview_requires_fake_model_provider",
        message: "workshop preview requires MODEL_PROVIDER=fake",
      },
    ];
  }
  return [];
}

export function prepareRuntimeWorkshopPreview(
  runtime: AtlieraRuntime,
): RuntimeWorkshopPreviewReport {
  const preflight = runRuntimePreflight(runtime.config);
  const previewFailures = getPreviewFailures(runtime);
  if (!preflight.ok || previewFailures.length > 0) {
    return {
      ok: false,
      kind: "workshop-preview",
      environment: runtime.config.environment,
      preflight,
      previewFailures,
      graphSnapshotRead: false,
      serverStarted: false,
      clientsConstructed: false,
      providerCallsMade: 0,
      productionWrites: false,
    };
  }

  const viewModel = buildWorkshopViewModel(runtime.graphStore.snapshot);
  return {
    ok: true,
    kind: "workshop-preview",
    environment: runtime.config.environment,
    preflight,
    previewFailures,
    viewModel,
    graphSnapshotRead: true,
    serverStarted: false,
    clientsConstructed: false,
    providerCallsMade: 0,
    productionWrites: false,
  };
}

export function prepareRuntimeWorkshopHtmlPreview(
  runtime: AtlieraRuntime,
): RuntimeWorkshopHtmlPreviewReport {
  const workshopPreview = prepareRuntimeWorkshopPreview(runtime);
  if (!workshopPreview.ok || !workshopPreview.viewModel) {
    return {
      ok: false,
      kind: "workshop-html-preview",
      environment: workshopPreview.environment,
      workshopPreview,
      htmlRendered: false,
      graphSnapshotRead: workshopPreview.graphSnapshotRead,
      serverStarted: false,
      clientsConstructed: false,
      providerCallsMade: 0,
      productionWrites: false,
    };
  }

  const html = renderWorkshopHtml(workshopPreview.viewModel);
  return {
    ok: true,
    kind: "workshop-html-preview",
    environment: workshopPreview.environment,
    workshopPreview,
    html,
    htmlRendered: true,
    graphSnapshotRead: workshopPreview.graphSnapshotRead,
    serverStarted: false,
    clientsConstructed: false,
    providerCallsMade: 0,
    productionWrites: false,
  };
}
