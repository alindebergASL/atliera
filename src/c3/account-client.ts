/** Tab-local reading position only. No account content, worksheet, or request is persisted here. */
export const ACCOUNT_READING_CLIENT_SCRIPT = `
(() => {
  document.querySelector('[data-research-topic]')?.addEventListener('change', event => {
    const route = event.target.value;
    if (['initiatives','people','technology','sources'].some(topic => route === '/?view=research&topic=' + topic)) window.location.assign(route);
  });
  const selected = document.querySelector('[data-selected="true"]');
  if(selected && !window.location?.hash) window.requestAnimationFrame?.(() => { selected.scrollIntoView?.({block:'nearest'}); selected.focus({preventScroll:true}); });
  if (!document.querySelector('.account-workspace')) return;
  const accountId = document.querySelector('meta[name="c3-account"]')?.getAttribute('content');
  const sessionId = document.querySelector('meta[name="c3-csrf"]')?.getAttribute('content');
  if (!accountId || !sessionId || typeof window === 'undefined') return;
  const key = 'atliera.c3.account-reading.v1:' + accountId + ':' + sessionId;
  const routes = ['/?prepare=1', '/?draft=1', '/?kind=strategy', '/?kind=next-steps'];
  window.addEventListener?.('pageshow', event => {
    if (event.persisted) { try { window.sessionStorage.removeItem(key); } catch { /* Native Back owns this restore. */ } }
  });
  const revealReading = hash => {
    if (!/^#reading-[a-z0-9-]+$/.test(hash)) return;
    const detail = document.getElementById(hash.slice(1))?.querySelector('.reading-detail');
    if (detail) { detail.open = true; detail.querySelector('summary')?.focus(); }
  };
  revealReading(window.location.hash);
  document.addEventListener('click', event => {
    const link = event.target?.closest?.('a[href]');
    const route = link?.getAttribute('href');
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && route?.startsWith('#reading-')) revealReading(route);
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !routes.includes(route)) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ y: window.scrollY || 0, origin: link.id || '', route }));
    } catch { /* Storage is optional; native browser Back remains available. */ }
  });
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;
    window.sessionStorage.removeItem(key);
    if (window.location.hash) return; // A deliberate source/topic link wins over earlier reading position.
    const saved = JSON.parse(raw);
    if (!saved || !Number.isFinite(saved.y) || saved.y < 0 || saved.y > 1000000 ||
        typeof saved.origin !== 'string' || !/^[a-zA-Z0-9_-]{0,100}$/.test(saved.origin) || !routes.includes(saved.route)) return;
    window.requestAnimationFrame(() => {
      const origin = saved.origin ? document.getElementById(saved.origin) : null;
      const fallback = document.querySelector('a[href="' + saved.route + '"]');
      (origin || fallback)?.focus({ preventScroll: true });
      window.scrollTo(0, saved.y);
    });
  } catch { /* Invalid/unavailable tab storage never blocks Account or Workshop. */ }
})();
`;
