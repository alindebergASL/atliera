import type { WorkshopLens, WorkshopLensItemViewModel, WorkshopViewModel } from "./view-model.ts";

const LENS_TITLES: Record<WorkshopLens, string> = {
  signals: "Signals",
  maps: "Maps",
  plays: "Plays",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function safeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function renderSourceReference(source: WorkshopLensItemViewModel["evidence_packets"][number]["source"]): string {
  const label = escapeHtml(source.title);
  const url = safeHttpUrl(source.url);
  const sourceLabel = url ? `<a href="${escapeHtml(url)}">${label}</a>` : `${label} <span class="unsafe-url">Unsafe source URL omitted</span>`;
  return `${sourceLabel} · ${escapeHtml(source.publisher ?? "unknown publisher")} · ${escapeHtml(source.reliability)} reliability`;
}

function renderEvidencePackets(item: WorkshopLensItemViewModel): string {
  if (item.evidence_packets.length === 0) {
    return `<p class="empty-evidence">No accepted supporting evidence packets for this object.</p>`;
  }
  return item.evidence_packets
    .map(
      (packet) => `<section class="evidence-packet">
        <h4>Evidence packet</h4>
        <dl>
          <dt>Claim</dt><dd>${escapeHtml(packet.claim.text)}</dd>
          <dt>Accepted excerpt</dt><dd><blockquote>${escapeHtml(packet.excerpt.text)}</blockquote></dd>
          <dt>Source</dt><dd>${renderSourceReference(packet.source)}</dd>
        </dl>
      </section>`,
    )
    .join("\n");
}

function renderLensItem(item: WorkshopLensItemViewModel): string {
  const evidence = item.trust.evidence;
  return `<article class="workshop-card" data-lens="${item.lens}" data-object-id="${escapeHtml(item.id)}">
    <div class="card-kicker">${escapeHtml(item.object_type)} · ${escapeHtml(item.status)}</div>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary)}</p>
    <div class="trust-row">
      <span class="trust-pill trust-${escapeHtml(item.trust.provenance_status)}">${escapeHtml(item.trust.label)}</span>
      <span>${escapeHtml(item.trust.confidence)} confidence</span>
      <span>${plural(evidence.accepted_excerpt_count, "accepted excerpt")}</span>
      <span>${plural(evidence.source_document_count, "source document")}</span>
    </div>
    <details class="evidence-drawer">
      <summary>Evidence</summary>
      <dl>
        <dt>Claims</dt><dd>${escapeHtml(item.claim_ids.join(", ") || "none")}</dd>
        <dt>Excerpts</dt><dd>${escapeHtml(item.excerpt_ids.join(", ") || "none")}</dd>
        <dt>Sources</dt><dd>${escapeHtml(item.source_ids.join(", ") || "none")}</dd>
      </dl>
      ${renderEvidencePackets(item)}
    </details>
  </article>`;
}

function renderLens(lens: WorkshopLens, items: WorkshopLensItemViewModel[]): string {
  const body = items.length
    ? items.map(renderLensItem).join("\n")
    : `<p class="empty-lens">No graph-backed ${LENS_TITLES[lens]} yet.</p>`;
  return `<section class="lens-panel" data-lens="${lens}">
    <header><h2>${LENS_TITLES[lens]}</h2><span>${plural(items.length, "item")}</span></header>
    ${body}
  </section>`;
}

export function renderWorkshopHtml(vm: WorkshopViewModel): string {
  const emptyState = vm.empty_state
    ? `<section class="empty-state"><h2>No graph-backed intelligence yet</h2><p>Add sources and validated graph records before treating account intelligence as verified.</p></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atliera Workshop</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #090b12; color: #edf2ff; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 40px 24px; }
    .hero { border: 1px solid #283044; border-radius: 24px; padding: 28px; background: linear-gradient(135deg, #121827, #0c1020); }
    .eyebrow { color: #99a7c7; text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; }
    h1 { margin: 8px 0; font-size: 42px; }
    .totals, .trust-row { display: flex; gap: 12px; flex-wrap: wrap; color: #aab6d3; }
    .lens-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 22px; }
    .lens-panel, .empty-state { border: 1px solid #283044; border-radius: 20px; padding: 18px; background: #0f1424; }
    .lens-panel header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #283044; margin-bottom: 14px; }
    .workshop-card { border: 1px solid #33405f; border-radius: 16px; padding: 14px; background: #121a2d; margin-bottom: 12px; }
    .card-kicker { color: #93a4c8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .trust-pill { border-radius: 999px; padding: 3px 9px; background: #26324e; color: #dbe7ff; }
    .trust-verified { background: #0f5132; color: #d1fae5; }
    .trust-unsupported { background: #5c1d1d; color: #fee2e2; }
    .evidence-drawer { margin-top: 10px; color: #cbd5e1; }
    .evidence-packet { border-top: 1px solid #283044; margin-top: 12px; padding-top: 10px; }
    .evidence-packet h4 { margin: 0 0 8px; color: #edf2ff; }
    .evidence-packet blockquote { margin: 0; padding-left: 10px; border-left: 3px solid #54658d; color: #e5edff; }
    .evidence-packet a { color: #93c5fd; }
    .unsafe-url { color: #fca5a5; }
    .empty-evidence { color: #93a4c8; }
    dt { color: #93a4c8; }
    dd { margin: 0 0 8px; word-break: break-word; }
    @media (max-width: 900px) { .lens-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="eyebrow">${escapeHtml(vm.product_name)} · ${escapeHtml(vm.surface)}</div>
      <h1>Atliera Workshop</h1>
      <p>Evidence-backed account intelligence rendered from the Atliera Graph.</p>
      <div class="totals">
        <span>${plural(vm.totals.sources, "source")}</span>
        <span>${plural(vm.totals.claims, "claim")}</span>
        <span>${plural(vm.totals.account_objects, "graph object")}</span>
        <span>${plural(vm.totals.verified_objects, "verified object")}</span>
      </div>
    </section>
    ${emptyState}
    <section class="lens-grid" aria-label="Workshop lenses">
      ${renderLens("signals", vm.lenses.signals)}
      ${renderLens("maps", vm.lenses.maps)}
      ${renderLens("plays", vm.lenses.plays)}
    </section>
  </main>
</body>
</html>`;
}
