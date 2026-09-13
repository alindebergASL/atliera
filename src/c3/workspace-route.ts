/** URL-owned workspace location. Legacy worksheet URLs remain first-class entry points. */
export type ResearchTopic = "initiatives" | "people" | "technology" | "sources";
export type WorkspaceDestination = "overview" | "research" | "workshop";
export interface C3AccountNavigation {
  readonly accountId: string;
  readonly accounts: readonly { readonly accountId: string; readonly accountName: string }[];
}

export function accountPath(accountId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/u.test(accountId)) throw new Error("Invalid canonical account identifier");
  return `/accounts/${accountId}`;
}
export type WorkspaceRoute =
  | { readonly destination: "overview" }
  | { readonly destination: "research"; readonly topic: ResearchTopic; readonly reading?: string }
  | { readonly destination: "workshop"; readonly task?: "prepare" | "draft" | "strategy" | "next-steps" };

export function parseWorkspaceRoute(params: URLSearchParams): WorkspaceRoute {
  for (const key of params.keys()) {
    if (!['kind', 'draft', 'prepare', 'view', 'topic', 'reading', 'from'].includes(key) || params.getAll(key).length !== 1) {
      throw new Error("Unknown or duplicate workspace parameter");
    }
  }
  const kind = params.get("kind");
  if (kind !== null) {
    if (kind !== "strategy" && kind !== "next-steps") throw new Error("Unknown brief kind");
    return { destination: "workshop", task: kind };
  }
  if (params.get("draft") === "1") return { destination: "workshop", task: "draft" };
  if (params.get("prepare") === "1") return { destination: "workshop", task: "prepare" };
  const destination = params.get("view") ?? "overview";
  if (destination === "overview" || destination === "workshop") return { destination };
  if (destination !== "research") throw new Error("Unknown workspace destination");
  const topic = params.get("topic") ?? "initiatives";
  if (!["initiatives", "people", "technology", "sources"].includes(topic)) throw new Error("Unknown research topic");
  const reading = params.get("reading");
  if (reading !== null && !/^[a-z0-9-]{1,100}$/u.test(reading)) throw new Error("Invalid research reading");
  return { destination, topic: topic as ResearchTopic, ...(reading === null ? {} : { reading }) };
}

export function researchUrl(topic: ResearchTopic, reading?: string): string {
  return `/?view=research&topic=${topic}${reading ? `&reading=${encodeURIComponent(reading)}` : ""}`;
}
