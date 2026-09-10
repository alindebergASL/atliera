/** Stage names are observations from the owned server operation, never timer-based estimates. */
export const GENERATION_PROGRESS_CLIENT_SCRIPT = `
  const observeGeneration = (operation, status, isCurrent, suffix = '') => {
    let stopped = false;
    let timer = null;
    const poll = async () => {
      if (stopped || !isCurrent()) return;
      try {
        const result = await requestJson('/api/generation-status', operation);
        if (stopped || !isCurrent() || result.operationId !== operation.operationId) return;
        if (result.active === true && ['preparing', 'checking-evidence'].includes(result.stage) && Number.isInteger(result.elapsedSeconds) && result.elapsedSeconds >= 0) {
          const label = recordedReplay ? 'Replaying locally' : result.stage === 'checking-evidence' ? 'Checking evidence' : 'Preparing';
          if (status) status.textContent = label + ' · ' + result.elapsedSeconds + 's elapsed.' + suffix;
        }
      } catch {
        if (!stopped && isCurrent() && status) status.textContent = 'Progress update unavailable; the request may still be running. Stop to request cancellation.' + suffix;
      }
      if (!stopped && isCurrent()) timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 1500);
    return () => { stopped = true; if (timer !== null) clearTimeout(timer); };
  };
`;
