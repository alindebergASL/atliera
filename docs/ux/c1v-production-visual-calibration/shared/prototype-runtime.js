(() => {
  'use strict';

  const body = document.body;
  let returnFocus = null;

  const setReviewState = (state) => {
    if (state !== 'no-plan' && state !== 'plan') return;
    body.dataset.reviewState = state;
    document.querySelectorAll('[data-state-control]').forEach((button) => {
      const active = button.getAttribute('data-state-control') === state;
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-plan-only]').forEach((node) => {
      node.hidden = state !== 'plan';
    });
    document.querySelectorAll('[data-no-plan-only]').forEach((node) => {
      node.hidden = state !== 'no-plan';
    });
  };

  document.querySelectorAll('[data-state-control]').forEach((button) => {
    button.addEventListener('click', () => {
      setReviewState(button.getAttribute('data-state-control'));
    });
  });

  document.querySelectorAll('[data-open-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-open-panel');
      const panel = target ? document.getElementById(target) : null;
      if (!(panel instanceof HTMLDialogElement)) return;
      returnFocus = button;
      panel.showModal();
      const close = panel.querySelector('[data-close-panel]');
      if (close instanceof HTMLElement) close.focus();
    });
  });

  document.querySelectorAll('[data-close-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = button.closest('dialog');
      if (panel instanceof HTMLDialogElement) panel.close();
    });
  });

  document.querySelectorAll('dialog').forEach((panel) => {
    panel.addEventListener('close', () => {
      const target = returnFocus;
      returnFocus = null;
      window.setTimeout(() => {
        if (target instanceof HTMLElement && target.isConnected) target.focus();
      }, 0);
    });
    panel.addEventListener('click', (event) => {
      if (event.target === panel) panel.close();
    });
  });

  const hostileProbe = '</script><img src=x onerror=alert(1)>javascript:alert(1)';
  const detached = document.createElement('div');
  detached.textContent = hostileProbe;
  if (detached.querySelector('*') !== null || detached.textContent !== hostileProbe) {
    throw new Error('C1V hostile-text safety probe failed');
  }

  setReviewState(body.dataset.reviewState || 'no-plan');
})();
