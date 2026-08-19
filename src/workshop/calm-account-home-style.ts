export const CALM_ACCOUNT_HOME_CSS = `
:root {
  --canvas: #f5f3ec;
  --surface: #fffefa;
  --ink: #10251e;
  --ink-2: #53625d;
  --evidence: #2f6b58;
  --evidence-wash: #e6eee9;
  --action: #1557e8;
  --action-wash: #e8efff;
  --open: #9c461b;
  --open-wash: #f8e6d8;
  --conflict: #a83c32;
  --conflict-wash: #f6e4e2;
  --border: #ccd2cb;
  --focus: #0b63f6;
  --shadow: 0 16px 38px rgba(16, 37, 30, .09);
  --r-sm: 10px;
  --r-md: 16px;
  --r-lg: 22px;
}
* { box-sizing: border-box; }
html { background: var(--canvas); color: var(--ink); scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--canvas);
  font: 16px/1.55 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  overflow-wrap: anywhere;
}
button, a, summary { font: inherit; touch-action: manipulation; }
button:focus-visible, a:focus-visible, summary:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
a { color: var(--action); text-underline-offset: 3px; }
.site-frame { min-height: 100vh; border-top: 7px solid var(--ink); }
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  width: min(100% - 40px, 1180px);
  margin: 0 auto;
  padding: 22px 0 18px;
  border-bottom: 1px solid var(--border);
}
.brand { margin: 0; font: 700 18px/1 Georgia, serif; letter-spacing: .01em; }
.purpose { margin: 5px 0 0; color: var(--ink-2); font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
.read-only { display: inline-flex; align-items: center; gap: 8px; margin: 0; color: var(--ink-2); font-size: 13px; }
.read-only::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--evidence); }
main { width: min(100% - 40px, 1180px); margin: 0 auto; padding: 44px 0 80px; }
.hero { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(260px, .45fr); gap: 70px; align-items: end; }
.eyebrow, .section-label, .source-kicker, .question-number {
  margin: 0;
  color: var(--evidence);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.account-name {
  margin: 10px 0 14px;
  font: 500 clamp(54px, 8vw, 96px)/.92 "Source Serif 4", Iowan Old Style, Georgia, serif;
  letter-spacing: -.055em;
}
.hero-thesis { max-width: 760px; margin: 0; font-size: clamp(22px, 3vw, 34px); line-height: 1.16; letter-spacing: -.025em; }
.hero-aside { border-top: 1px solid var(--ink); padding-top: 18px; }
.hero-aside p { margin: 0; color: var(--ink-2); }
.trust-line {
  margin: 18px 0 0;
  padding: 13px 16px;
  border-left: 3px solid var(--evidence);
  background: var(--evidence-wash);
  color: var(--ink);
  font-size: 13px;
  font-weight: 650;
}
.story { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 26px; margin-top: 48px; }
.story-rail { position: relative; color: var(--ink-2); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
.story-rail::after {
  content: "";
  position: absolute;
  top: 34px;
  bottom: 0;
  left: 7px;
  width: 2px;
  background: linear-gradient(var(--evidence), var(--open), var(--action));
}
.story-body { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(320px, .88fr); column-gap: 58px; min-width: 0; }
.story-section { position: relative; min-width: 0; padding: 0 0 38px 32px; border-left: 1px solid var(--border); }
.story-section:nth-child(1) { grid-column: 1; grid-row: 1; }
.story-section:nth-child(2) { grid-column: 1; grid-row: 2; }
.story-section:last-child { padding-bottom: 0; }
.story-section::before {
  content: "";
  position: absolute;
  left: -7px;
  top: 4px;
  width: 12px;
  height: 12px;
  border: 2px solid var(--canvas);
  border-radius: 50%;
  background: var(--node, var(--evidence));
}
.story-section.open { --node: var(--open); }
.story-section.next { --node: var(--action); }
.story-section h2 {
  margin: 8px 0 12px;
  font: 500 clamp(32px, 4vw, 52px)/1.02 "Source Serif 4", Iowan Old Style, Georgia, serif;
  letter-spacing: -.035em;
}
.story-copy { max-width: 820px; margin: 0; font-size: clamp(18px, 2vw, 24px); line-height: 1.32; }
.origin-line { display: flex; flex-wrap: wrap; gap: 10px 16px; margin: 14px 0 0; color: var(--ink-2); font-size: 13px; }
.origin-line span { display: inline-flex; align-items: center; gap: 7px; }
.origin-line span::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.evidence-trigger {
  min-height: 44px;
  margin-top: 14px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--action);
  font-weight: 750;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.next-plane {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: start;
  margin-top: 0;
  padding: 28px 30px;
  border-left: 0;
  border-radius: var(--r-lg);
  background: var(--ink);
  color: var(--surface);
  box-shadow: var(--shadow);
}
.next-plane .eyebrow { color: #aad7c6; }
.next-plane h2 { font-size: clamp(34px, 4vw, 50px); }
.next-plane .story-copy { color: #f1f0e9; }
.next-plane .origin-line { color: #c8d2cd; }
.next-plane .trust-line { border-color: #aad7c6; background: rgba(230, 238, 233, .12); color: #f1f0e9; }
.next-plane .evidence-trigger {
  color: #b8caff;
  display: flex;
  width: max-content;
  max-width: 100%;
  margin-top: 14px;
}
.primary-action {
  min-height: 48px;
  margin-top: 16px;
  padding: 0 22px;
  border: 1px solid var(--action);
  border-radius: 10px;
  background: var(--action);
  color: white;
  font-weight: 800;
  cursor: pointer;
}
.horizon { margin: 54px 0 0; padding: 24px 28px 20px; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--border); }
.horizon h2 { margin: 0 0 22px; font: 500 28px/1.1 Georgia, serif; }
.horizon ol { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin: 0; padding: 0; list-style: none; }
.horizon ol::before { content: ""; position: absolute; top: 9px; left: 6px; right: 6px; height: 2px; background: linear-gradient(90deg, var(--evidence), var(--open), var(--action)); }
.horizon-step { position: relative; min-width: 0; padding-top: 28px; }
.horizon-node { position: absolute; top: 2px; left: 0; width: 16px; height: 16px; border: 3px solid var(--canvas); border-radius: 50%; background: var(--evidence); }
.horizon-2 .horizon-node { background: var(--open); }
.horizon-3 .horizon-node { background: var(--action); }
.horizon-label { margin: 0; color: var(--ink); font-weight: 850; }
.explore { margin-top: 42px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.explore summary { min-height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 16px; cursor: pointer; font-weight: 800; list-style: none; }
.explore summary::-webkit-details-marker { display: none; }
.explore summary::after { content: "+"; font-size: 24px; color: var(--action); }
.explore[open] summary::after { content: "−"; }
.secondary-list { margin: 0; padding: 0 0 30px; list-style: none; }
.secondary-list li { display: grid; grid-template-columns: 48px 1fr; gap: 16px; padding: 20px 0; border-top: 1px solid var(--border); }
.secondary-rank { color: var(--ink-2); font-size: 12px; font-weight: 800; }
.secondary-list p { margin: 4px 0 0; }
.boundary-footer { margin-top: 40px; color: var(--ink-2); font-size: 13px; }
.evidence-dialog {
  width: min(720px, calc(100vw - 24px));
  max-height: min(820px, calc(100vh - 24px));
  padding: 0;
  border: 0;
  border-radius: var(--r-lg);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 22px 80px rgba(16, 37, 30, .3);
}
.evidence-dialog::backdrop { background: rgba(16, 37, 30, .58); }
.dialog-frame { display: grid; grid-template-rows: auto minmax(0, 1fr); max-height: inherit; }
.dialog-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding: 24px 26px 18px; border-bottom: 1px solid var(--border); }
.dialog-header h2 { margin: 5px 0 0; font: 500 32px/1.05 Georgia, serif; }
.icon-button { min-width: 72px; min-height: 44px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--ink); font-weight: 750; cursor: pointer; }
.dialog-scroll { overflow: auto; padding: 26px; overscroll-behavior: contain; }
.related-statement { padding: 20px; background: var(--action-wash); border-radius: var(--r-md); }
.statement-copy { margin: 8px 0 0; font-size: 19px; font-weight: 650; }
.compact-state { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; }
.compact-state span { padding: 5px 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); font-size: 12px; }
.evidence-source { margin-top: 24px; padding-top: 22px; border-top: 1px solid var(--border); }
.evidence-source h3 { margin: 5px 0 12px; }
.evidence-source blockquote { margin: 0; padding: 18px 20px; border-left: 3px solid var(--evidence); background: var(--evidence-wash); font: 500 18px/1.45 Georgia, serif; }
.source-meta, .question-detail, .plan-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin: 18px 0; }
.source-meta div, .question-detail div, .plan-summary div { min-width: 0; }
.source-meta dt, .question-detail dt, .plan-summary dt { color: var(--ink-2); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.source-meta dd, .question-detail dd, .plan-summary dd { margin: 3px 0 0; }
.source-link-unavailable { color: var(--ink-2); font-size: 13px; }
.source-reference { display: grid; gap: 4px; margin: 14px 0 0; }
.source-reference span { color: var(--ink-2); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.source-reference code { color: var(--ink); font: 12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
.boundary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 24px; }
.boundary-grid > div { padding: 18px; border-radius: var(--r-md); }
.boundary-grid h3 { margin: 0 0 8px; }
.boundary-grid p { margin: 0; }
.supports { background: var(--evidence-wash); }
.does-not { background: var(--open-wash); }
.plan-summary { padding: 20px; background: var(--evidence-wash); border-radius: var(--r-md); }
.plan-questions { margin: 28px 0 0; padding: 0; list-style: none; }
.plan-questions > li { padding: 24px 0; border-top: 1px solid var(--border); }
.plan-questions h3 { margin: 6px 0 14px; font: 500 24px/1.15 Georgia, serif; }
.close-criterion { padding: 20px; background: var(--open-wash); border-radius: var(--r-md); }
.close-criterion p:last-child { margin: 6px 0 0; }
.plan-boundary { color: var(--ink-2); font-size: 13px; }
.dialog-scroll::-webkit-scrollbar { width: 10px; }
.dialog-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }
@media (max-width: 900px) {
  main { padding-top: 34px; }
  .hero { grid-template-columns: 1fr; gap: 0; margin-top: 30px; }
  .hero-aside { display: none; }
  .story { grid-template-columns: 1fr; margin-top: 36px; }
  .story-rail { display: none; }
  .story-body { display: block; }
  .story-section { padding: 0 0 24px 30px; }
  .story-section:not(.next-plane) .origin-line { display: none; }
  .story-section:not(.next-plane) h2 { width: calc(100% - 220px); }
  .story-section:not(.next-plane) .evidence-trigger { position: absolute; top: 0; right: 0; margin-top: 0; }
  .next-plane { display: block; grid-column: auto; grid-row: auto; padding: 22px; }
  .horizon ol { grid-template-columns: 1fr; gap: 24px; }
  .horizon ol::before { top: 6px; bottom: 12px; left: 7px; right: auto; width: 2px; height: auto; background: linear-gradient(var(--evidence), var(--open), var(--action)); }
  .horizon-step { padding: 0 0 0 30px; }
  .horizon-node { top: 3px; }
  .source-meta, .question-detail, .plan-summary, .boundary-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .masthead, main { width: min(100% - 24px, 1180px); }
  .masthead { align-items: flex-start; padding-top: 12px; padding-bottom: 16px; }
  .read-only { max-width: 118px; text-align: right; font-size: 10px; }
  main { padding-top: 16px; }
  .hero { margin-top: 14px; }
  .account-name { font-size: 42px; }
  .hero-thesis { margin-top: 12px; font-size: 17px; line-height: 1.42; }
  .story { margin-top: 12px; }
  .story-section { padding: 0 0 16px 22px; }
  .story-section h2 { margin-top: 4px; margin-bottom: 8px; font-size: 26px; }
  .story-copy { font-size: 16px; line-height: 1.4; }
  .story-section:not(.next-plane) h2 { width: calc(100% - 96px); }
  .story-section:not(.next-plane) .evidence-trigger { width: 88px; font-size: 0; text-align: right; }
  .story-section:not(.next-plane) .evidence-trigger::after { content: "Evidence"; font-size: 12px; }
  .next-plane { margin-left: -4px; margin-right: -4px; padding: 14px; }
  .next-plane .origin-line { margin-top: 10px; }
  .next-plane .trust-line { margin-top: 12px; padding: 8px 10px; font-size: 11px; }
  .next-plane .primary-action { margin-top: 12px; }
  .horizon { padding: 24px 4px; }
  .dialog-header, .dialog-scroll { padding-left: 18px; padding-right: 18px; }
  .dialog-header h2 { font-size: 26px; }
  .secondary-list li { grid-template-columns: 36px 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

export const CALM_ACCOUNT_HOME_SCRIPT = `
(() => {
  let returnFocus = null;
  document.querySelectorAll('[data-dialog]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-dialog');
      const dialog = id ? document.getElementById(id) : null;
      if (!(dialog instanceof HTMLDialogElement)) return;
      returnFocus = button;
      dialog.showModal();
      const close = dialog.querySelector('[data-close-dialog]');
      if (close instanceof HTMLElement) close.focus();
    });
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      const target = returnFocus;
      returnFocus = null;
      queueMicrotask(() => {
        if (target instanceof HTMLElement && target.isConnected) target.focus();
      });
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
})();
`;
