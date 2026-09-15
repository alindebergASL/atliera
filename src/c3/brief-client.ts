/** Brief-first surface client: authored-copy keep via version-checked endpoint, canonical export
 *  from the version-bound formatter (never DOM scraping), real clipboard with truthful denial fallback, real
 *  Blob download. Refuses export truthfully when the editor holds unsubmitted changes. */
export const BRIEF_CLIENT_SCRIPT = `
  let saveBriefWork = async () => {};
  const briefPage = document.querySelector('[data-brief-record]');
  if (briefPage) {
    const status = document.querySelector('[data-authored-status]');
    const exportStatus = document.querySelector('[data-brief-export-status]');
    const exportNote = document.querySelector('[data-brief-export-note]');
    const form = document.querySelector('[data-authored-form]');
    const recordId = briefPage.getAttribute('data-brief-record');
    const collect = () => {
      const value = name => (form.querySelector('[data-authored="' + name + '"]')?.value ?? '').trim();
      const questions = [0,1,2].map(index => {
        const question = value('q' + index + 'question');
        const probe = value('q' + index + 'probe');
        return question ? { question, ...(probe ? { probe } : {}) } : null;
      }).filter(Boolean);
      return {
        provenance: 'user-authored',
        priorRecordId: recordId,
        title: value('title'),
        audience: value('audience'),
        duration: value('duration'),
        purpose: value('purpose'),
        facts: value('facts').split(/\\r?\\n/).map(line => line.trim()).filter(Boolean),
        interpretation: value('interpretation'),
        opening: value('opening'),
        questions,
        close: value('close'),
        uncertainty: value('uncertainty'),
        selectedEvidenceRefs: value('evidence').split(/\\r?\\n/).map(line => line.trim()).filter(Boolean),
      };
    };
    let submitted = briefPage.getAttribute('data-kept-copy') ? JSON.parse(briefPage.getAttribute('data-kept-copy')) : null;
    const rawFields = ['title','audience','duration','purpose','facts','interpretation','opening','close','uncertainty','evidence', ...[0,1,2].flatMap(index => ['q' + index + 'question','q' + index + 'probe'])];
    const rawForm = () => JSON.stringify(rawFields.map(name => form.querySelector('[data-authored="' + name + '"]')?.value ?? ''));
    const initialForm = rawForm();
    const dirty = () => rawForm() !== initialForm;
    const displayedVersion = Number(briefPage.getAttribute('data-brief-work-version'));
    let storageVersion = Number(briefPage.getAttribute('data-brief-storage-version'));
    let busy = false;
    let leaving = false;
    const priorBriefDeparture = confirmDirtyNavigation;
    confirmDirtyNavigation = () => !busy && priorBriefDeparture() && (!dirty() || window.confirm('Leave with unsubmitted meeting copy? Cancel to keep editing.'));
    window.addEventListener('beforeunload', event => { if (!leaving && (dirty() || busy)) { event.preventDefault(); event.returnValue = ''; } });
    form.querySelector('[data-authored-reset]')?.addEventListener('click', () => { form.reset(); syncExportNote(); });
    const syncExportNote = () => {
      if (!exportNote) return;
      if (dirty()) exportNote.textContent = 'The editor below has unsubmitted changes. Keep or reset them before copying or downloading the current brief.';
      else exportNote.textContent = submitted ? 'Exports the user-authored brief shown above.' : 'Exports the original-record reading shown above.';
    };
    syncExportNote();
    form?.addEventListener('input', syncExportNote);
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!status) return;
      if (busy) return;
      const orphan = [0,1,2].find(index => !form.querySelector('[data-authored="q' + index + 'question"]').value.trim() && form.querySelector('[data-authored="q' + index + 'probe"]').value.trim());
      if (orphan !== undefined) { status.textContent = 'Add a question for optional probe ' + (orphan + 1) + ', or clear the probe. Your edited text remains in the form.'; return; }
      const payload = collect(); const before = rawForm(); busy = true;
      try {
        const result = await requestJson('/api/authored-copy', { recordId, workVersion: displayedVersion, copy: payload });
        if (result.kept !== true || result.recordId !== recordId) throw Error(result.error || 'Authored copy was not confirmed');
        submitted = result.authoredCopy;
        status.textContent = result.status || 'Authored copy kept for this session. Save the brief to retain it.';
        const clear = form.querySelector('[data-authored-clear]'); if (clear) clear.hidden = false;
        if (rawForm() !== before) { status.textContent = 'Submitted copy kept. Newer typing remains here; copy it before reloading.'; return; }
        leaving = true; window.location.reload();
      } catch (error) { status.textContent = error.message + ' Your edited text remains in the form.'; } finally { busy = false; }
    });
    form?.querySelector('[data-authored-clear]')?.addEventListener('click', async () => {
      if (!status) return;
      if (busy || !window.confirm('Clear the kept authored copy and return to the original record?')) return;
      const before = rawForm(); busy = true;
      try {
        const result = await requestJson('/api/authored-copy', { recordId, workVersion: displayedVersion, copy: null });
        if (result.kept !== true) throw Error(result.error || 'Clearing was not confirmed');
        submitted = null; status.textContent = 'Authored copy cleared. The original-record reading is shown.';
        if (rawForm() !== before) { status.textContent = 'Kept copy cleared. Newer typing remains here; copy it before reloading.'; return; }
        leaving = true; window.location.reload();
      } catch (error) { status.textContent = error.message; } finally { busy = false; }
    });
    saveBriefWork = async (copy = false) => {
      if (busy) return;
      if (dirty()) { workStatus.textContent = 'Keep or reset your edited meeting copy before saving.'; return; }
      busy = true; workStatus.textContent = 'Saving…';
      try {
        const result = await persistDisplayedWork({recordId, documentId:workDocumentId, version:storageVersion, workVersion:displayedVersion, attachmentDigest:briefPage.getAttribute('data-brief-attachment-digest')}, copy);
        if (result.saved !== true || result.recordId !== recordId || result.workVersion !== displayedVersion || result.version !== (copy ? 1 : storageVersion + 1) || !/^doc_[a-f0-9]{24}$/.test(result.documentId) || !copy && result.documentId !== workDocumentId) throw Error('Save was not confirmed.');
        workDocumentId = result.documentId; storageVersion = result.version; showSavedTime(result.savedAt);
        workStatus.textContent = dirty() ? 'Saved submitted copy. Newer typing is unsaved.' : 'Saved';
        document.querySelector('[data-save-work]').hidden = !dirty();
        document.querySelector('[data-save-copy]').hidden = true;
        document.querySelector('[data-brief-saved-state]').textContent = 'Saved version ' + result.version;
      } catch (error) { workStatus.textContent = error.message + ' Local text kept.'; document.querySelector('[data-save-copy]').hidden = error.status !== 409; }
      finally { busy = false; }
    };
    const currentExport = async () => {
      if (dirty()) return { error: 'The editor has unsubmitted changes. Keep or reset them, then export again.' };
      const result = await requestJson('/api/brief-export', { recordId, workVersion: displayedVersion });
      if (dirty()) throw Error('Editor changed while preparing export. Submit or reset edits first.');
      if (result.recordId !== recordId || typeof result.exportText !== 'string') throw Error(result.error || 'Export content was not confirmed for this brief.');
      return result;
    };
    document.querySelector('[data-brief-copy]')?.addEventListener('click', async () => {
      if (!exportStatus) return;
      try {
        const result = await currentExport();
        if (result.error) { exportStatus.textContent = result.error; return; }
        try {
          if (!navigator.clipboard || !navigator.clipboard.writeText) throw Error('clipboard unavailable');
          await navigator.clipboard.writeText(result.exportText);
          exportStatus.textContent = 'Brief copied to clipboard.';
        } catch {
          const fallback = document.querySelector('[data-brief-fallback]');
          if (fallback) { fallback.value = result.exportText; fallback.hidden = false; fallback.select(); }
          exportStatus.textContent = 'Clipboard copy was denied. The brief text is selected below for manual copying.';
        }
      } catch (error) { exportStatus.textContent = error.message; }
    });
    document.querySelectorAll('[data-brief-download]').forEach(button => button.addEventListener('click', async () => {
      if (!exportStatus) return;
      try {
        const result = await currentExport();
        if (result.error) { exportStatus.textContent = result.error; return; }
        const kind = button.getAttribute('data-brief-download');
        const blob = new Blob([result.exportText], { type: kind === 'md' ? 'text/markdown' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'brief.' + (kind === 'md' ? 'md' : 'txt');
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        exportStatus.textContent = 'Download requested: ' + link.download + '.';
      } catch (error) { exportStatus.textContent = error.message; }
    }));
  }
`;
