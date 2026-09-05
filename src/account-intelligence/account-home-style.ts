export const C2_ACCOUNT_HOME_CSS = `
:root {
  --paper: #f7f1e5;
  --paper-strong: #fffaf0;
  --ink: #24201d;
  --muted: #6f675f;
  --rule: rgba(36,32,29,.24);
  --plum: #49253d;
  --cobalt: #1647b9;
  --blue-wash: #e7ebf9;
  --warm-wash: #efe4d5;
  --review: #8c3d2f;
  --focus: #0b63f6;
  --serif: Iowan Old Style, Baskerville, Georgia, serif;
  --sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html { background: var(--paper); color: var(--ink); scroll-behavior: smooth; }
body { margin: 0; background: var(--paper); font: 16px/1.5 var(--sans); overflow-wrap: anywhere; }
button, summary { font: inherit; touch-action: manipulation; }
button:focus-visible, summary:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
.site-frame { min-height: 100vh; border-top: 4px solid var(--ink); }
.product-header {
  display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 20px;
  width: min(100% - 48px, 1320px); margin: 0 auto; padding: 14px 0 12px;
  border-bottom: 1px solid var(--rule);
}
.brand { margin: 0; font: 700 17px/1 var(--serif); letter-spacing: .01em; }
.mode-line { display: flex; align-items: center; gap: 10px; margin: 0; color: var(--muted); font-size: 12px; }
.mode-active { color: var(--ink); font-weight: 800; }
.mode-future { color: var(--muted); opacity: 1; }
main { width: min(100% - 48px, 1320px); margin: 0 auto; padding: 18px 0 68px; }
.intro-line { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.intro-line::after { content: ""; height: 1px; flex: 1; background: var(--rule); }
.eyebrow, .stage-kicker, .section-label, .source-kicker {
  margin: 0; color: var(--cobalt); font-size: 11px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase;
}
.freshness { margin: 0; color: var(--muted); font-size: 12px; }
.review-cue { color: var(--review); font-weight: 800; }
.account-hero { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(230px, .35fr); gap: 54px; padding-left: clamp(0px, 4vw, 58px); }
.account-hero h1 { margin: 4px 0 6px; font: 500 clamp(40px, 5.3vw, 78px)/.94 var(--serif); letter-spacing: -.052em; }
.account-thesis { max-width: 900px; margin: 0; font: 500 clamp(19px, 1.8vw, 27px)/1.23 var(--serif); letter-spacing: -.02em; text-wrap: balance; }
.hero-aside { align-self: end; padding-top: 12px; border-top: 1px solid var(--ink); color: var(--muted); font-size: 13px; }
.hero-aside p { margin: 0; }
.grammar {
  display: grid; grid-template-columns: minmax(0, .88fr) minmax(480px, 1.12fr); gap: clamp(30px, 4vw, 60px);
  margin: 20px 0 0 clamp(0px, 4vw, 58px); align-items: stretch;
}
.context-plane { border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); }
.stage { position: relative; padding: 16px 0 14px 58px; }
.stage + .stage { border-top: 1px solid var(--rule); }
.stage-num { position: absolute; left: 0; top: 17px; color: var(--plum); font: 800 11px/1 var(--sans); letter-spacing: .12em; }
.stage h2 { margin: 4px 0 5px; font: 500 clamp(25px, 2.4vw, 38px)/1.02 var(--serif); letter-spacing: -.03em; }
.stage-copy { margin: 0; font-size: clamp(14px, 1.15vw, 17px); line-height: 1.34; }
.stage-source-quote { margin: 0; }
.stage-source-quote blockquote { margin: 0; font-size: clamp(14px, 1.15vw, 17px); line-height: 1.34; }
.stage-source-quote figcaption { margin-top: 5px; color: var(--muted); font-size: 11px; font-weight: 700; }
.inline-source-note { margin: 7px 0 0; color: var(--review); font-size: 12px; }
.analysis-line { margin: 7px 0 0; color: var(--muted); font-size: 13px; }
.statement-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 7px; }
.statement-state { color: var(--muted); font-size: 11px; letter-spacing: .04em; }
.evidence-trigger {
  min-width: 44px; min-height: 44px; padding: 8px 4px; border: 0; background: transparent; color: var(--cobalt);
  font-weight: 800; font-size: 12px; text-decoration: underline; text-underline-offset: 4px; cursor: pointer;
}
.decision-plane { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 28px; padding: 22px 28px; background: var(--plum); color: #fffaf3; }
.decision-plane .stage { padding: 0; }
.decision-plane .stage + .stage { border: 0; padding-left: 26px; border-left: 1px solid rgba(255,255,255,.26); }
.decision-plane .stage-num { position: static; display: block; margin-bottom: 6px; color: #e2cfd8; }
.decision-plane .stage h2 { margin-top: 0; font-size: clamp(25px, 2.25vw, 36px); color: #fffaf3; }
.decision-plane .stage-copy { color: #f0e7eb; }
.decision-plane .statement-state { color: #d8cbd1; }
.decision-plane .evidence-trigger { color: #cdd9ff; }
.decision-plane button:focus-visible { outline-color: #ffd166; }
.primary-action {
  min-height: 44px; margin-top: 9px; padding: 0 17px; border: 1px solid #fffaf3; border-radius: 0;
  background: #fffaf3; color: var(--plum); font-weight: 850; cursor: pointer;
}
.research-disclosure { margin: 26px 0 0 clamp(0px, 10vw, 150px); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.research-disclosure summary { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 20px; cursor: pointer; list-style: none; font-weight: 800; }
.research-disclosure summary::-webkit-details-marker { display: none; }
.research-disclosure summary::after { content: "+"; color: var(--cobalt); font-size: 22px; }
.research-disclosure[open] summary::after { content: "−"; }
.research-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; padding: 18px 0 26px; }
.research-grid h3 { margin: 0 0 10px; font: 500 24px/1.05 var(--serif); }
.research-grid ul { margin: 0; padding-left: 18px; }
.research-grid li + li { margin-top: 7px; }
.coverage-list { list-style: none; padding: 0 !important; }
.coverage-list li { display: grid; grid-template-columns: 150px 1fr; gap: 12px; padding: 7px 0; border-top: 1px solid var(--rule); }
.coverage-state { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
.boundary-footer { margin: 22px 0 0; color: var(--muted); font-size: 12px; }
.evidence-dialog {
  width: min(760px, calc(100vw - 24px)); max-height: min(820px, calc(100vh - 24px)); padding: 0;
  border: 0; background: var(--paper-strong); color: var(--ink); box-shadow: 0 24px 90px rgba(36,32,29,.34);
}
.evidence-dialog::backdrop { background: rgba(36,32,29,.58); }
.dialog-frame { display: grid; grid-template-rows: auto minmax(0, 1fr); max-height: inherit; }
.dialog-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding: 22px 24px 16px; border-bottom: 1px solid var(--rule); }
.dialog-header h2 { margin: 4px 0 0; font: 500 31px/1.04 var(--serif); }
.icon-button { min-width: 70px; min-height: 44px; border: 1px solid var(--rule); background: var(--paper-strong); color: var(--ink); font-weight: 800; cursor: pointer; }
.dialog-scroll { overflow: auto; padding: 24px; overscroll-behavior: contain; }
.related-statement { padding: 18px; background: var(--blue-wash); }
.related-statement p:last-child { margin: 7px 0 0; }
.evidence-source { padding: 20px 0; border-bottom: 1px solid var(--rule); }
.evidence-source h3 { margin: 5px 0 10px; font: 500 23px/1.1 var(--serif); }
.evidence-source blockquote { margin: 0; padding: 15px 18px; border-left: 3px solid var(--cobalt); background: var(--paper); font: 500 17px/1.42 var(--serif); }
.evidence-annotation { margin-top: 10px; padding: 11px 13px; border-left: 3px solid var(--review); background: var(--warm-wash); color: var(--ink); font-size: 13px; }
.evidence-annotation p { margin: 0; }
.source-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin: 15px 0 0; }
.source-meta dt { color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
.source-meta dd { margin: 2px 0 0; }
.source-url { margin: 12px 0 0; color: var(--muted); font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
.evidence-boundary { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 20px; }
.evidence-boundary > div { padding: 16px; background: var(--warm-wash); }
.evidence-boundary h3 { margin: 0 0 6px; }
.evidence-boundary p { margin: 0; }
@media (min-width: 901px) and (max-width: 1350px) {
  .product-header { padding: 11px 0 9px; }
  main { padding-top: 12px; }
  .intro-line { margin-bottom: 9px; }
  .account-hero { gap: 36px; }
  .account-hero h1 { font-size: clamp(38px, 4.6vw, 62px); }
  .account-thesis { font-size: clamp(18px, 1.55vw, 22px); }
  .grammar { margin-top: 14px; gap: 28px; }
  .stage { padding-top: 12px; padding-bottom: 10px; }
  .stage-num { top: 13px; }
  .stage h2 { font-size: clamp(24px, 2.1vw, 31px); }
  .stage-copy { font-size: 14px; }
  .analysis-line { margin-top: 4px; }
  .statement-tools { margin-top: 4px; }
  .decision-plane { padding: 18px 22px; }
  .decision-plane .stage h2 { font-size: clamp(24px, 2vw, 29px); }
}
@media (max-width: 900px) {
  .account-hero { grid-template-columns: 1fr; gap: 0; padding-left: 0; }
  .hero-aside { display: none; }
  .grammar { grid-template-columns: 1fr; margin-left: 0; gap: 18px; }
  .decision-plane { grid-template-columns: 1fr 1fr; }
  .research-disclosure { margin-left: 0; }
}
@media (max-width: 520px) {
  .product-header, main { width: min(100% - 24px, 1320px); }
  .product-header { padding: 10px 0 9px; }
  .mode-line { font-size: 10px; gap: 6px; }
  main { padding-top: 10px; }
  .intro-line { margin-bottom: 8px; }
  .freshness { font-size: 10px; }
  .account-hero h1 { margin-top: 2px; font-size: 38px; }
  .account-thesis { font-size: 16px; line-height: 1.3; }
  .grammar { margin-top: 10px; gap: 0; }
  .stage { padding: 8px 0 7px 38px; }
  .stage-num { top: 12px; }
  .stage h2 { margin-top: 1px; font-size: 23px; }
  .stage-copy { font-size: 14px; line-height: 1.32; }
  .analysis-line { margin-top: 6px; font-size: 12px; }
  .statement-tools { margin-top: 3px; }
  .decision-plane { grid-template-columns: 1fr; gap: 13px; padding: 15px; }
  .decision-plane .stage + .stage { padding: 13px 0 0; border-left: 0; border-top: 1px solid rgba(255,255,255,.26); }
  .decision-plane .stage h2 { font-size: 23px; }
  .primary-action { margin-top: 7px; }
  .research-grid, .source-meta, .evidence-boundary { grid-template-columns: 1fr; }
  .coverage-list li { grid-template-columns: 110px 1fr; }
  .dialog-header, .dialog-scroll { padding-left: 17px; padding-right: 17px; }
  .dialog-header h2 { font-size: 25px; }
}
@media (max-width: 360px) {
  .product-header, main { width: min(100% - 20px, 1320px); }
  .intro-line { align-items: flex-start; gap: 8px; }
  .intro-line::after { display: none; }
  .account-hero h1 { font-size: 34px; }
  .stage { padding-left: 32px; }
  .decision-plane { padding: 13px 12px; }
  .coverage-list li { grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .evidence-trigger, .primary-action, .icon-button { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

export const C2_ACCOUNT_HOME_SCRIPT = `
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
    dialog.querySelectorAll('[data-close-dialog]').forEach((button) => {
      button.addEventListener('click', () => dialog.close());
    });
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
