/** Small progressive enhancement for session edits; never invokes the model route. */
export const PLANNING_CLIENT_SCRIPT = `
((requestJson) => {
  const forms = Array.from(document.querySelectorAll?.('[data-local-edit]') || []);
  if (!forms.length) return;
  const csrf = document.querySelector('meta[name="c3-csrf"]')?.content || '';
  const account = document.querySelector('meta[name="c3-account"]')?.content || '';
  let busy = false;
  let revisionPending = false;
  const states = forms.map((form) => {
    const fields = [...Array.from(form.querySelectorAll('textarea')), ...Array.from(form.querySelectorAll('input[type="text"]')), ...Array.from(form.querySelectorAll('select[multiple]'))];
    const read = (field) => field.multiple ? Array.from(field.options).filter((option) => option.selected).map((option) => option.value) : field.value;
    const write = (field, value) => { if (field.multiple) Array.from(field.options).forEach((option) => { option.selected = value.includes(option.value); }); else field.value = value; };
    const valid = (field, value) => field.multiple ? Array.isArray(value) && value.length <= 32 && new Set(value).size === value.length && value.every((id) => typeof id === 'string' && Array.from(field.options).some((option) => option.value === id)) : typeof value === 'string' && value.length <= field.maxLength;
    const values = () => Object.fromEntries(fields.map((field) => [field.name, read(field)]));
    const status = form.querySelector('[data-local-status]');
    const key = 'atliera.c3.local-edit.v1:' + account + ':' + csrf + ':' + form.dataset.editKey;
    const identity = () => form.dataset.recordId || form.dataset.version;
    const state = { form, fields, values, status, key, saved: values(), cached: false, staleCache: false };
    const cache = () => {
      if (state.staleCache) { status.textContent = 'Older recovery belongs to a different saved baseline. Copy current typing before leaving; older recovery was kept.'; return; }
      try { window.sessionStorage.setItem(key, JSON.stringify({ identity: identity(), saved: state.saved, values: values() })); state.cached = true; }
      catch { state.cached = false; status.textContent = 'Reload recovery unavailable. Keep this page open or copy unsaved text before leaving.'; }
    };
    let recovery = null;
    const clear = () => { try { window.sessionStorage.removeItem(key); } catch { return false; }
      state.cached = false; state.staleCache = false; recovery?.remove(); recovery = null; return true; };
    state.cache = cache; state.clear = clear;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const cached = JSON.parse(raw);
        // Control types can change on reload; cache property order is not baseline identity.
        const sameBaseline = cached.saved && typeof cached.saved === 'object' && !Array.isArray(cached.saved) &&
          Object.keys(cached.saved).length === Object.keys(state.saved).length &&
          Object.keys(state.saved).every((name) => Object.prototype.hasOwnProperty.call(cached.saved, name) && JSON.stringify(cached.saved[name]) === JSON.stringify(state.saved[name]));
        if (cached.identity === identity() && sameBaseline && fields.every((field) => valid(field, cached.values?.[field.name]))) {
          fields.forEach((field) => { write(field, cached.values[field.name]); });
          state.cached = true;
          if (JSON.stringify(values()) !== JSON.stringify(state.saved)) { form.closest('details').open = true; status.textContent = 'Unsubmitted edit restored in this tab. Keep it deliberately for this session.'; }
        } else { state.staleCache = true; status.textContent = 'An older unsubmitted edit exists for a different brief version or saved baseline. Copy it below before discarding; current saved content was kept.';
          recovery = document.createElement('pre'); recovery.className = 'source-text'; recovery.textContent = JSON.stringify(cached.values, null, 2); status.after(recovery); form.closest('details').open = true; }
      }
    } catch { status.textContent = 'Reload recovery unavailable. Copy unsaved text before leaving.'; }
    form.addEventListener('input', cache);
    form.addEventListener('change', cache);
    form.querySelector('[data-local-cancel]').addEventListener('click', () => {
      if (busy) return;
      fields.forEach((field) => { write(field, state.saved[field.name]); });
      status.textContent = clear() ? 'Edit cancelled. Saved section and brief kept.' : 'Edit cancelled here; reload recovery could not be cleared.';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (busy || revisionPending) return; busy = true;
      const submitted = values(); cache();
      const section = form.dataset.section;
      const body = form.dataset.recordId ? { recordId: form.dataset.recordId, section, text: submitted.text, priorText: state.saved.text } :
        { version: Number(form.dataset.version), ...(form.dataset.proposedNextStep !== undefined ? { proposedNextStep: submitted } : section ? { section, text: submitted.text } : submitted) };
      forms.forEach((item) => item.querySelectorAll('button').forEach((button) => { button.disabled = true; }));
      status.textContent = 'Keeping session edit… The brief remains available.';
      try {
        if (!['/api/planning/strategy', '/api/planning/next-steps', '/api/section-note'].includes(form.dataset.endpoint)) throw new Error('Unknown session edit route');
        const result = await requestJson(form.dataset.endpoint, body);
        if (!result || typeof result !== 'object' || result.error || typeof result.status !== 'string' || !result.status ||
            typeof result.noChange !== 'boolean' || ('recordId' in body &&
              (result.recordId !== body.recordId || result.section !== body.section || result.savedText !== submitted.text)) || (!('recordId' in body) &&
              result.version !== Number(form.dataset.version) + (result.noChange ? 0 : 1))) {
          throw new Error('Session save was not confirmed by a valid response');
        }
        state.saved = submitted;
        const dirty = JSON.stringify(values()) !== JSON.stringify(submitted);
        if (result.version !== undefined) {
          forms.filter((item) => item.dataset.version !== undefined).forEach((item) => { item.dataset.version = String(result.version); });
          states.filter((item) => item !== state && JSON.stringify(item.values()) !== JSON.stringify(item.saved)).forEach((item) => item.cache());
        }
        const container = form.closest('.draft-section') || form.closest('.section-note');
        if (form.dataset.proposedNextStep !== undefined) {
          fields.forEach((field) => {
            const projection = container.querySelector('[data-proposed-value="' + field.name + '"]');
            if (projection) projection.textContent = field.multiple ? (submitted[field.name].map((id) => Array.from(field.options).find((option) => option.value === id)?.label || id).join(' · ') || 'Not set') : (submitted[field.name].trim() ? submitted[field.name] : (field.name === 'owner' || field.name === 'targetDate' ? 'Unassigned' : 'Not set'));
          });
          const summary = container.querySelector('[data-proposal-status]');
          if (summary) summary.textContent = 'User-authored proposed next step · session-only';
        }
        const copy = container.querySelector('[data-saved-copy]');
        if (copy) { copy.textContent = form.dataset.recordId ? (submitted.text ? 'User note · ' + submitted.text : '') : submitted.text || 'Section cleared. No conclusion asserted.'; if (form.dataset.recordId) copy.hidden = !submitted.text; }
        const authorship = container.querySelector('[data-authorship]');
        if (authorship && !result.noChange) authorship.textContent = 'User-authored session edit';
        const setup = container.querySelector('[data-setup-summary]');
        if (setup) { setup.textContent = submitted.audience + ' · ' + submitted.intendedOutcome; container.querySelector('[data-detail-summary]').textContent = submitted.detail; }
        status.textContent = result.status + (dirty ? ' Newer typing is still unsubmitted.' : '');
        if (dirty) cache(); else if (!clear()) status.textContent += ' Reload recovery could not be cleared; saved content is on the server.';
      } catch (error) { status.textContent = error.message + ' Your text and saved brief are kept; retry or cancel the edit.'; }
      finally { busy = false; forms.forEach((item) => item.querySelectorAll('button').forEach((button) => { button.disabled = false; })); }
    });
    return state;
  });
  canStartRevision = () => !busy;
  setSectionRevisionPending = (pending) => {
    revisionPending = pending;
    forms.filter((form) => form.dataset.recordId).forEach((form) => form.querySelectorAll('button').forEach((button) => { button.disabled = pending || busy; }));
  };
  rebindSectionNotes = (recordId, notes) => {
    states.filter((state) => state.form.dataset.recordId).forEach((state) => {
      const acknowledged = notes[state.form.dataset.section] || '';
      if (acknowledged !== state.saved.text) throw new Error('Section note baseline changed. Reopen the current brief; local edits kept.');
    });
    states.filter((state) => state.form.dataset.recordId).forEach((state) => {
      state.form.dataset.recordId = recordId;
      state.saved = { text: notes[state.form.dataset.section] || '' };
      if (!state.staleCache) { if (JSON.stringify(state.values()) !== JSON.stringify(state.saved)) state.cache(); else state.clear(); }
    });
  };
  let departureApproved = false;
  resetLocalEditDeparture = () => { departureApproved = false; };
  const needsGuard = () => busy || states.some((state) => JSON.stringify(state.values()) !== JSON.stringify(state.saved));
  confirmLocalEditDeparture = () => {
    if (busy) { states[0].status.textContent = 'Wait for the session save to finish before leaving.'; return false; }
    if (departureApproved || !needsGuard()) return true;
    departureApproved = typeof window.confirm === 'function' && window.confirm('Leave with unsubmitted section edits? Copy or keep them first if you need them.');
    return departureApproved;
  };
  forms.forEach((form) => ['input', 'change'].forEach((event) => form.addEventListener(event, () => { departureApproved = false; })));
  window.addEventListener('beforeunload', (event) => {
    if (busy || states.some((state) => !state.cached && JSON.stringify(state.values()) !== JSON.stringify(state.saved))) { event.preventDefault(); event.returnValue = ''; }
  });
})(requestJson);`;
