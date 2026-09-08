/** Shared workspace tokens and responsive controls. */
export const WORKSPACE_CSS = `
/* Atliera modern workspace v2 — approved restrained-violet direction.
 * Reference tokens, not a running application.
 * Integrate into existing components; verify contrast and responsive behavior.
 * Rendered mockup pixels are approximate. These values are deliberate starting points.
 */
:root {
  --atl-canvas: #f6f7f9;
  --atl-surface: #ffffff;
  --atl-ink: #171a1f;
  --atl-muted: #626b78;
  --atl-line: #e4e7ec;
  --atl-control-line: #7f8792;
  --atl-neutral-soft: #f1f3f6;
  --atl-secondary-ink: var(--atl-ink);
  --atl-icon-ink: #505965;
  --atl-icon-surface: var(--atl-neutral-soft);
  --atl-question-ink: var(--atl-ink);
  --atl-question-surface: var(--atl-neutral-soft);
  --atl-accent: #6652c6;
  --atl-accent-hover: #5542b2;
  --atl-accent-soft: #efecfa;
  --atl-primary-fill: var(--atl-accent);
  --atl-primary-ink: #ffffff;
  --atl-selection-ink: var(--atl-accent);
  --atl-selection-surface: var(--atl-accent-soft);
  --atl-proposal-surface: var(--atl-accent-soft);
  --atl-ordinary-content-surface: var(--atl-surface);
  --atl-context-note-surface: var(--atl-neutral-soft);
  --atl-success: var(--atl-ink);
  --atl-success-soft: var(--atl-neutral-soft);
  --atl-warning: var(--atl-ink);
  --atl-warning-soft: var(--atl-neutral-soft);
  --atl-error: var(--atl-ink);
  --atl-error-soft: var(--atl-neutral-soft);
  --atl-font: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --atl-title: 1.75rem;
  --atl-section: 1.25rem;
  --atl-body: 1rem;
  --atl-meta: .875rem;
  --atl-body-leading: 1.5;
  --atl-title-leading: 1.2;
  --atl-weight-normal: 400;
  --atl-weight-medium: 500;
  --atl-weight-strong: 600;
  --atl-space-1: 4px;
  --atl-space-2: 8px;
  --atl-space-3: 12px;
  --atl-space-4: 16px;
  --atl-space-5: 24px;
  --atl-space-6: 32px;
  --atl-space-7: 48px;
  --atl-sidebar: 208px;
  --atl-topbar-min: 64px;
  --atl-content-inset: 32px;
  --atl-inspector: 360px;
  --atl-reading-max: 68ch;
  --atl-control-min: 44px;
  --atl-control-radius: 10px;
  --atl-surface-radius: 14px;
  --atl-focus-ring: 0 0 0 3px #6652c6;
  --atl-inspector-shadow: -8px 0 28px rgb(23 26 31 / .05);
  --atl-duration-fast: 120ms;
  --atl-duration-panel: 180ms;
  --atl-ease: cubic-bezier(.2, .7, .2, 1);
}

@media (max-width: 700px) {
  :root {
    --atl-title: 1.5rem;
    --atl-content-inset: 20px;
    --atl-topbar-min: 56px;
    --atl-mobile-nav-min: 64px;
    --atl-mobile-safe-bottom: env(safe-area-inset-bottom, 0px);
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --atl-duration-fast: 0ms;
    --atl-duration-panel: 0ms;
  }
}

/* Implementation notes:
 * - Account context remains visible at all sizes.
 * - Allow navigation/content scrolling; never use screenshot-height clipping.
 * - Reserve mobile content padding for bottom navigation + safe area.
 * - Controls can grow with text; 44px is a minimum, not a fixed height.
 * - Do not let a 360px inspector force a narrow document into a tiny column.
 * - Use real focus styles with an offset, and keep labels readable at zoom.
 * - Borders are separators, not the sole indication that a control is interactive.
 * - Use labels together with color for status.
 * - In-app evidence uses a document icon; external-link arrows open source sites.
 * - Primary action: solid accent fill; selected nav/topic: selection tokens.
 * - Violet is not a default link, icon, question-number, card or warning color.
 * - Ordinary links/actions use ink and a clear label, underline or control shape.
 * - Use accent-soft only for actual selection or a generated revision proposal.
 * - Context notes, excerpts, original text and question rows stay neutral.
 * - Use control-line where the outline is needed to identify an input/control.
 * - line is a subtle separator; it is not a sufficient control boundary alone.
 * - Focus is a temporary interaction state and can use violet on neutral controls.
 * - Add a surface-colored offset so the focus ring contrasts with filled buttons.
 */

:root{font-family:var(--atl-font);color:var(--atl-ink);background:var(--atl-canvas);font-size:16px;--ink:var(--atl-ink);--muted:var(--atl-muted);--line:var(--atl-line);--wash:var(--atl-neutral-soft)}
*{box-sizing:border-box}body{margin:0;line-height:var(--atl-body-leading)}[hidden]{display:none!important}h1,h2,h3,p{margin:0 0 12px}h1{font-size:var(--atl-title);line-height:var(--atl-title-leading);font-weight:600}h2{font-size:var(--atl-section);line-height:1.3;font-weight:600}h3{font-size:1rem;font-weight:600;line-height:1.4}p,li,dd,h1,h2,h3,a,span,pre{overflow-wrap:anywhere}a{color:var(--atl-ink);text-underline-offset:3px}a,button,summary,input,select,textarea{touch-action:manipulation}a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--atl-accent);outline-offset:4px;box-shadow:0 0 0 2px var(--atl-surface)}
.workspace-sidebar{position:fixed;inset:0 auto 0 0;width:var(--atl-sidebar);padding:24px 16px;overflow:auto;background:var(--atl-canvas)}.brand{display:inline-flex;align-items:center;min-height:44px;font-size:28px;font-weight:600;letter-spacing:-1px;text-decoration:none;margin:0 12px 24px}.sidebar-context{color:var(--atl-muted);font-size:var(--atl-meta);margin:0 12px 16px}.workspace-nav{display:flex;flex-direction:column;gap:8px}.workspace-nav a{display:flex;align-items:center;gap:12px;min-height:48px;padding:12px;border-radius:var(--atl-control-radius);text-decoration:none}.workspace-nav a[aria-current]{color:var(--atl-selection-ink);background:var(--atl-selection-surface);font-weight:600;box-shadow:inset 3px 0 var(--atl-accent)}.workspace-nav svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;flex-shrink:0}.workspace-frame{margin-left:var(--atl-sidebar);min-height:100dvh;background:var(--atl-surface)}.workspace-header{min-height:var(--atl-topbar-min);padding:10px var(--atl-content-inset);border-bottom:1px solid var(--atl-line);display:flex;align-items:center;justify-content:space-between;gap:16px}.account-identity{font-size:20px;font-weight:600;min-width:0}.workspace-header>a{flex-shrink:0}.skip-link{position:fixed;top:-100px;left:16px;background:var(--atl-surface);padding:12px;z-index:10}.skip-link:focus{top:12px}
main{padding:var(--atl-content-inset);min-width:0;max-width:1500px;margin:auto}main>*{min-width:0}footer,.recorded-mode{margin:0 var(--atl-content-inset);padding:12px 0;font-size:var(--atl-meta);color:var(--atl-muted)}footer{border-top:1px solid var(--atl-line)}.recorded-mode{margin-top:16px}.recorded-mode p{max-width:var(--atl-reading-max)}.meta,.boundary,.support,.source-attribution,.proposed-cue,.badge,.account-subtitle,.section-intro,.learning,.status-line{font-size:var(--atl-meta);color:var(--atl-muted)}.lede{font-size:1rem;max-width:var(--atl-reading-max);color:var(--atl-muted)}.eyebrow,.review-label{font-size:var(--atl-meta);color:var(--atl-muted);margin-bottom:12px}.quiet-link{display:inline-flex;align-items:center;min-height:44px;max-width:100%;gap:8px}.hero-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0}.button,button{font:500 1rem/1.4 var(--atl-font);min-height:var(--atl-control-min);max-width:100%;display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border:1px solid var(--atl-control-line);border-radius:var(--atl-control-radius);background:var(--atl-surface);color:var(--atl-ink);text-decoration:none;cursor:pointer;white-space:normal}.button:not(.secondary),form.prepare button[type=submit],button[data-revise],button[data-apply-revision]{background:var(--atl-primary-fill);color:var(--atl-primary-ink);border-color:var(--atl-accent)}.button:not(.secondary):hover,form.prepare button[type=submit]:hover,button[data-revise]:hover{background:var(--atl-accent-hover)}button:disabled{opacity:.65;cursor:not-allowed}summary{min-height:44px;cursor:pointer;padding:10px 0;color:var(--atl-ink);font-weight:500}details[open]>summary{margin-bottom:8px}
.account-readout{margin-bottom:24px}.account-readout h1{max-width:48ch}.account-readout .support{margin:0}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:12px}.section-heading h2{margin:0}.account-section{margin:24px 0}.priority-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.priority-tile{display:block;padding:20px;border:1px solid var(--atl-line);border-radius:var(--atl-surface-radius);text-decoration:none}.priority-tile:hover,.summary-row:hover{background:var(--atl-neutral-soft)}.priority-tile h3 span,.summary-row h3 span{float:right;margin-left:8px}.priority-tile p{font-size:var(--atl-meta);color:var(--atl-muted)}.priority-tile p:last-child{margin:0}.priority-tile h3{margin-bottom:8px}.account-columns{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.summary-section{padding:20px;border:1px solid var(--atl-line);border-radius:var(--atl-surface-radius)}.summary-row{display:block;text-decoration:none;padding:16px 0;border-bottom:1px solid var(--atl-line)}.summary-row p{font-size:var(--atl-meta);color:var(--atl-muted)}.summary-row p:last-child{margin:0}.context-note{padding:16px 20px;background:var(--atl-context-note-surface);border-radius:var(--atl-control-radius);margin:20px 0}.context-note p:last-child{margin:0}.reading-limit{color:var(--atl-muted);font-size:var(--atl-meta)}.research-topics{display:flex;gap:4px;flex-wrap:wrap;margin:20px 0 28px;padding:4px;border:1px solid var(--atl-line);border-radius:var(--atl-control-radius);width:fit-content}.research-topics a{padding:10px 16px;min-height:44px;text-decoration:none;border-radius:8px}.research-topics a[aria-current]{color:var(--atl-selection-ink);background:var(--atl-selection-surface);font-weight:600;box-shadow:inset 0 -2px var(--atl-accent)}.research-workspace>section,.research-workspace>.account-reading{max-width:var(--atl-reading-max);margin-bottom:32px}.account-reading{padding:20px 0;border-bottom:1px solid var(--atl-line)}.account-reading h3{font-size:18px}.account-reading:target{scroll-margin-top:24px}.research-source{padding:20px 0;border-bottom:1px solid var(--atl-line)}.source-scope{font-size:var(--atl-meta);color:var(--atl-muted)}.support{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.support a{display:inline-flex;align-items:center;min-height:44px;max-width:100%;padding:8px 12px;border:1px solid var(--atl-line);border-radius:var(--atl-control-radius);text-decoration:underline;background:var(--atl-surface)}.support a[data-inspected]{border-color:var(--atl-accent)}.support>span{flex-basis:100%}.unreviewed-research{margin:32px 0}.research-group{margin:24px 0}.research-inspection{border-top:1px solid var(--atl-line);padding:12px 0}.research-summary{display:block}.reading-expand{display:block;font-size:var(--atl-meta);color:var(--atl-muted);margin-top:8px}.research-inspection-body{padding:12px 0}.account-questions{padding-left:20px}.account-questions li{margin-bottom:16px}
blockquote,.direct-source{margin:16px 0;padding:16px;background:var(--atl-neutral-soft);border-left:3px solid var(--atl-line);font:400 1rem/1.6 var(--atl-font);overflow-wrap:anywhere}.source-text{font:var(--atl-meta)/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:480px;overflow:auto;padding:16px;background:var(--atl-neutral-soft)}.warning{border-left:3px solid var(--atl-warning);padding:12px 16px;background:var(--atl-warning-soft);font-size:var(--atl-meta);margin:16px 0}.evidence-list,.account-details,.technical-detail{margin-top:24px;max-width:var(--atl-reading-max)}.evidence-list>details{padding:12px 0;border-top:1px solid var(--atl-line)}
dialog[data-evidence-dialog]{position:fixed;inset:0 0 0 auto;margin:0;width:min(var(--atl-inspector),100%);height:100dvh;max-height:100dvh;max-width:100%;padding:24px;background:var(--atl-surface);color:var(--atl-ink);border:0;border-left:1px solid var(--atl-line);overflow:auto;overscroll-behavior:contain;box-shadow:var(--atl-inspector-shadow)}dialog::backdrop{background:rgb(23 26 31 / .3)}.evidence-panel-head{position:sticky;top:-24px;background:var(--atl-surface);padding:12px 0;display:flex;align-items:start;justify-content:space-between;gap:12px;z-index:1}.evidence-panel-head h2{font-size:20px}.evidence-panel-head button{padding:8px;font-size:var(--atl-meta)}body:has(dialog[open]) .workspace-header .button{background:var(--atl-surface);color:var(--atl-ink);border-color:var(--atl-control-line)}
.prepare-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:32px;align-items:start}.prepare-layout>*{min-width:0}.field{margin:18px 0}.field label,.review label,.section-note label{display:block;font-weight:600;margin-bottom:8px}.field input,.field select,.field textarea,.review textarea,.section-note textarea{width:100%;min-width:0;min-height:44px;padding:12px;border:1px solid var(--atl-control-line);border-radius:var(--atl-control-radius);background:var(--atl-surface);color:var(--atl-ink);font:inherit}.field textarea,.review textarea,.section-note textarea{min-height:108px;resize:vertical}.option-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.meeting-options{border-block:1px solid var(--atl-line)}.status-line{min-height:24px;margin:16px 0}.form-recovery{margin-top:16px}.brief-context{border:1px solid var(--atl-line);border-radius:var(--atl-surface-radius);padding:16px 20px}.brief-context>summary{font-size:20px}.work-context{padding:16px 0}.work-context h3{margin-top:24px}.brief-anchor{border-top:1px solid var(--atl-line)}.secondary-worksheets{margin:24px 0}.journey-nav{display:flex;gap:16px;flex-wrap:wrap}.journey-nav a{min-height:44px;display:inline-flex;align-items:center}.journey-nav a[aria-current]{font-weight:600}.workshop-list{max-width:var(--atl-reading-max)}.workshop-item{padding:20px 0;border-bottom:1px solid var(--atl-line)}.workshop-empty{padding:24px 0}.meeting-context{display:grid;grid-template-columns:1fr auto;gap:12px 24px;margin:20px 0}.meeting-context dt{font-size:var(--atl-meta);color:var(--atl-muted)}.meeting-context dd{margin:0}.meeting-context .outcome{grid-column:1/-1}.draft-head,.draft-grid,.checks,.review{max-width:var(--atl-reading-max)}.draft-grid{margin-top:24px}.draft-section{padding:24px 0;border-top:1px solid var(--atl-line)}.draft-section p{margin:8px 0}.section-note{margin-top:16px}.questions{list-style:none;padding:0;counter-reset:q}.questions li{counter-increment:q;position:relative;padding:20px 0 20px 52px;border-top:1px solid var(--atl-line)}.questions li:before{content:counter(q,decimal-leading-zero);position:absolute;left:0;top:18px;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--atl-question-surface);color:var(--atl-question-ink)}.questions strong{font-weight:500}.optional-probe{font-size:var(--atl-meta)}.review{color:var(--atl-ink);padding:24px;margin:24px 0;border:1px solid var(--atl-line);border-radius:var(--atl-surface-radius)}.review button{margin:12px 8px 0 0}.recorded-note pre,.user-copy{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit}.planning-work{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:32px}.planning-work>*{min-width:0}.proposal-owner-date{display:grid;grid-template-columns:1fr 1fr;gap:16px}.kept-proposal dd{margin:0 0 16px}
@media(min-width:1440px){body:has(dialog[data-evidence-dialog][open]) .workspace-frame{margin-right:var(--atl-inspector)}dialog[data-evidence-dialog]{width:var(--atl-inspector)}}
@media(min-width:701px) and (max-width:1050px){:root{--atl-sidebar:80px;--atl-content-inset:24px}.workspace-sidebar{padding:16px 8px}.brand{font-size:18px;margin:0 0 24px;letter-spacing:-.7px}.sidebar-context{display:none}.workspace-nav a{flex-direction:column;gap:4px;padding:10px 2px;font-size:11px}.priority-grid{grid-template-columns:1fr}.account-columns{grid-template-columns:1fr}.prepare-layout,.planning-work{grid-template-columns:1fr}}
@media(max-width:700px){.workspace-sidebar{position:static;padding:0;width:auto;overflow:visible}.workspace-sidebar>.brand,.sidebar-context{display:none}.workspace-nav{position:fixed;z-index:3;bottom:0;left:0;right:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;min-height:var(--atl-mobile-nav-min);padding:4px 8px calc(4px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--atl-line);background:var(--atl-surface)}.workspace-nav a{flex-direction:column;gap:2px;font-size:12px;padding:6px;min-width:0}.workspace-nav a[aria-current]{box-shadow:inset 0 -2px var(--atl-accent)}.workspace-frame{margin:0;padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))}.workspace-header{flex-wrap:wrap;gap:4px 12px;padding-block:8px}.account-identity{font-size:18px;flex:1 1 100%}.workspace-header .button{min-height:44px;padding:8px 12px;font-size:var(--atl-meta)}.workspace-header .quiet-link{font-size:var(--atl-meta)}.priority-grid,.account-columns,.prepare-layout,.planning-work,.option-grid,.proposal-owner-date{grid-template-columns:minmax(0,1fr)}.account-columns,.prepare-layout{gap:20px}.priority-tile,.summary-section{padding:16px}.section-heading{align-items:start;gap:8px}.section-heading>a{flex-shrink:0}.research-topics{width:100%;display:grid;grid-template-columns:1fr 1fr}.research-topics a{padding:10px;text-align:center}.hero-actions>*{flex-grow:1}.review{padding:16px}.review button{width:100%;margin-right:0}.meeting-context{grid-template-columns:1fr}.meeting-context .outcome{grid-column:auto}.questions li{padding-left:48px}dialog[data-evidence-dialog]{inset:0;width:100%;height:100dvh;padding:20px 20px calc(20px + env(safe-area-inset-bottom,0px))}.evidence-panel-head{top:-20px}.support a{font-size:var(--atl-meta)}}
.storage-notice{margin:12px var(--atl-content-inset) 0;color:var(--atl-muted);font-size:var(--atl-meta)}.work-toolbar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:var(--atl-meta);margin:16px 0}.preparation-anchor{padding:16px 0;border-bottom:1px solid var(--atl-line)}.preparation-anchor p{font-size:var(--atl-meta)}.preparation-anchor .source-opener{margin-right:12px}.revision-original,.revision-proposed{white-space:pre-wrap;padding:16px;border-radius:10px;background:var(--atl-neutral-soft)}.revision-proposed{border:1px solid var(--atl-control-line)}[data-revision-panel] textarea{width:100%;min-height:108px;padding:12px;margin:8px 0 24px;border:1px solid var(--atl-control-line);border-radius:10px;font:inherit;color:var(--atl-ink);background:var(--atl-surface);resize:vertical}.revision-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}body:has(dialog[open] [data-revision-panel]:not([hidden])) [data-save-work]{background:var(--atl-surface);color:var(--atl-ink)}[data-save-work]{background:var(--atl-accent);color:white;border-color:var(--atl-accent)}.account-readout .lede{max-width:65ch}
@media(max-width:700px){.account-readout{margin-bottom:16px}.account-readout h1{font-size:1.5rem}.account-readout .lede{font-size:.9375rem}.account-section{margin:16px 0}.priority-grid{gap:12px}.priority-tile{padding:14px 16px}.priority-tile p{margin-bottom:6px}.account-columns{gap:16px}.summary-row{padding:12px 0}.workspace-header:has(.button) .account-identity{flex:1 1 160px}.workspace-header:has(.button){flex-wrap:nowrap}.workspace-header:has(.button) .button{flex:0 0 auto}.revision-actions>*{flex:1 1 45%}}
[data-revision-differences]:empty{display:none}
[data-revision-panel][data-has-proposal=true] [data-revise]{background:var(--atl-surface);color:var(--atl-ink);border-color:var(--atl-control-line)}[data-revision-panel][data-has-proposal=false] [data-apply-revision]{background:var(--atl-surface);color:var(--atl-ink);border-color:var(--atl-control-line)}
`;
