/** Shared document refinement and explicit private-work persistence. No provider response applies itself. */
export const WORKING_DOCUMENT_CLIENT_SCRIPT = `
  const instruction = document.querySelector('[data-revision-instruction]');
  const revisionPanel = document.querySelector('[data-revision-panel]');
  let syncedInstruction = instruction?.value || '';
  let instructionQueue = Promise.resolve();
  let pendingRevisionToken = reviewForm?.getAttribute('data-pending-revision-token') || null;
  let proposalId = revisionPanel?.getAttribute('data-proposal-id') || null;
  let proposalStale = revisionPanel?.getAttribute('data-proposal-stale') === 'true';
  let proposalInstruction = revisionPanel?.getAttribute('data-proposal-instruction') || '';
  revisionVisited = Boolean(instruction?.value || pendingRevisionToken || proposalId);
  const revisionRequestText = reviewForm?.getAttribute('data-meeting-request');
  const revisionRequest = revisionRequestText ? JSON.parse(revisionRequestText) : null;
  const reviewStatus = document.querySelector('[data-review-status]');
  const revisionStatus = document.querySelector('[data-revision-status]');
  let revisionOperation = null;
  let stopRequested = false;
  let cancelSettlement = null;
  let workEpoch = 0;
  let workDirty = false;
  let workNavigationApproved = false;
  let saveBusy = false;
  const workStatus = document.querySelector('[data-work-status]');
  const workControls = document.querySelector('[data-work-controls]');
  const markWorkDirty = () => { const save = document.querySelector('[data-save-work]'); if(save) save.hidden = false; workEpoch++; workDirty = true; workNavigationApproved = false; if(workStatus) workStatus.textContent = workControls?.getAttribute('data-store-available') === 'true' ? 'Unsaved changes' : 'Session only'; };
  let proposalNoteSnapshot = null;
  const noteSnapshot = () => JSON.stringify([correctionNote?.value || '', Object.entries(displayedSectionNotes()).sort(([a],[b])=>a.localeCompare(b))]);
  // Compare successive displayed values, not the proposal baseline: edit → revert is still an edit.
  let observedNotes = null;
  let noteEditEpoch = 0;
  document.addEventListener?.('input', (event) => {
    if(!reviewForm || !event.target?.closest?.('main, [data-revision-panel]')) return;
    const notes = noteSnapshot();
    const changed = observedNotes !== null && observedNotes !== notes;
    observedNotes = notes;
    if(changed) { noteEditEpoch++; if(pendingRevisionToken || reviewBusy) proposalStale = true; }
    else if(event.target === correctionNote || event.target?.closest?.('[data-local-edit][data-section]')) return;
    markWorkDirty(); controls();
  });
  const notesChangedForProposal = () => proposalNoteSnapshot !== null && proposalNoteSnapshot !== noteSnapshot();
  const currentRecord = () => reviewForm?.getAttribute('data-record-id');
  const controls = () => {
    if(observedNotes === null) observedNotes = noteSnapshot();
    if(proposalId && proposalNoteSnapshot === null) proposalNoteSnapshot = noteSnapshot();
    const stale = !proposalId || proposalStale || instruction?.value !== proposalInstruction || noteIsDirty() || notesChangedForProposal();
    if(revisionPanel) revisionPanel.setAttribute('data-has-proposal', proposalId ? 'true' : 'false');
    const apply = document.querySelector('[data-apply-revision]'); if(apply) apply.disabled = reviewBusy || stale;
    const revise = document.querySelector('[data-revise]'); if(revise) { revise.disabled = reviewBusy || !instruction?.value.trim() || revisionPanel?.getAttribute('data-generation-available') !== 'true' || (recordedReplay && reviewForm?.getAttribute('data-revised') === 'true'); revise.textContent = pendingRevisionToken ? 'Revise again' : 'Revise'; }
    const keep = document.querySelector('[data-discard-revision]'); if(keep) keep.disabled = reviewBusy || !pendingRevisionToken;
    const stop = document.querySelector('[data-stop-revision]'); if(stop) stop.disabled = !reviewBusy;
    if (proposalId && stale && revisionStatus && !reviewBusy) revisionStatus.textContent = 'Instructions or notes changed. Revise again before applying; the current brief is unchanged.';
    // Section annotations are independent work, including while generation is running.
    setSectionRevisionPending(false);
    inspectorRoutes();
  };
  const syncInstruction = () => {
    const value = instruction?.value || '';
    instructionQueue = instructionQueue.catch(() => {}).then(async () => {
      if (!instruction || value === syncedInstruction) return;
      const result = await requestJson('/api/revision-instruction', {recordId:currentRecord(),instruction:value,priorInstruction:syncedInstruction});
      if(result.error || result.instruction !== value) throw Error(result.error || 'Instruction recovery not confirmed');
      syncedInstruction = value;
    });
    return instructionQueue;
  };
  instruction?.addEventListener('input', () => { if(pendingRevisionToken)proposalStale=true; controls(); syncInstruction().catch(error => { revisionStatus.textContent = error.message + ' Typed instruction kept here.'; }); });
  const openRevisionSheet = (section, restore = false, origin = null) => {
    if(!revisionPanel || !evidenceDialog) return;
    retainInspectorView(); presentInspector(origin); revisionVisited = true; inspectorMode = 'revision';
    evidenceDialog.querySelector('[data-evidence-panel-body]').hidden = true;
    evidenceDialog.querySelector('[data-evidence-support]').hidden = true;
    evidenceDialog.querySelector('#evidence-panel-title').textContent = section === 'Opening' ? 'Revise opening' : 'Revise brief';
    revisionPanel.hidden = false; revisionPanel.scrollTop = restore ? revisionScroll : 0;
    instruction?.focus?.({preventScroll:restore}); controls(); inspectorRoutes();
  };
  const sameOperation = (a,b) => a && b && a.operationId===b.operationId && a.recordId===b.recordId && a.pendingRevisionToken===b.pendingRevisionToken && JSON.stringify(a.request)===JSON.stringify(b.request);
  const displayProposal = (payload) => {
    if(payload.proposalReady !== true || payload.recordId !== currentRecord() || !/^c3_[a-f0-9]{24}$/.test(payload.proposalId) || !payload.proposal || typeof payload.instruction !== 'string') throw Error('Proposal acknowledgement incomplete. Current brief kept.');
    proposalId=payload.proposalId; proposalStale=proposalStale || payload.stale === true || instruction.value!==payload.instruction; proposalInstruction=payload.instruction;
    const comparison=document.querySelector('[data-proposal-comparison]'); comparison.replaceChildren();
    const sections=[['Opening','opening'],['Situation','audienceThesis'],['Objective','objective'],['Questions','questions'],['Useful close','closeCriterion'],['Risks and unknowns','risksUnknowns'],['Warnings','warnings'],['Evidence','selectedEvidenceRefs'],['Temporal outcome','temporalOutcome']];
    const content = value => typeof value==='string' ? value : Array.isArray(value) ? value.map(item=>typeof item==='string'?item:item.question ? item.question+' '+item.intendedLearning : item.text || item.message).join('\\n\\n') : value?.text || '';
    let changed=0;
    sections.forEach(([label,key])=>{if(JSON.stringify(payload.proposal[key])===JSON.stringify(payload.original[key]))return;changed++;
      const section=document.createElement('section');const heading=document.createElement('h3');heading.textContent='Proposed '+label.toLowerCase();
      const proposed=document.createElement('p');proposed.className='revision-proposed';proposed.textContent=content(payload.proposal[key]);
      const originalLabel=document.createElement('h3');originalLabel.textContent='Original '+label.toLowerCase();
      const original=document.createElement('p');original.className='revision-original';original.textContent=content(payload.original[key]);section.append(heading,proposed,originalLabel,original);comparison.append(section);
    });
    if(!changed)comparison.textContent='No content change proposed. Keep original, or change the instruction and regenerate.';
    comparison.hidden=false;markWorkDirty();controls();
  };
  const generateRevision = async () => {
    const owned={request:revisionRequest,recordId:currentRecord(),pendingRevisionToken,operationId:window.crypto.randomUUID().replaceAll('-','')};
    revisionOperation=owned;
    revisionStatus.textContent=recordedReplay ? 'Replaying the exact recorded revision locally… Current brief stays unchanged.' : 'Preparing a proposal… Current brief stays unchanged.';
    try {
      const payload=await requestJson('/api/generate',owned);
      if(!sameOperation(payload.operation,owned))throw Error('Revision operation was not confirmed.');
      if(stopRequested || payload.outcome !== 'succeeded')throw Error(payload.error || 'Revision stopped. Current brief kept.');
      displayProposal(payload); revisionStatus.textContent='Compare the proposal, then Apply revision or Keep original.';
    }finally{if(cancelSettlement)await cancelSettlement;revisionOperation=null;}
  };
  document.querySelector('[data-revise]')?.addEventListener('click',async()=>{
    if(reviewBusy || !canStartRevision())return;
    reviewBusy=true;stopRequested=false;controls();
    const submitted=instruction.value;
    if(!submitted.trim()){revisionStatus.textContent='No revision requested. Add an instruction first.';reviewBusy=false;controls();return;}
    // Capture before any preparation awaits: note acknowledgements must not adopt newer typing.
    proposalNoteSnapshot = noteSnapshot();
    observedNotes = proposalNoteSnapshot; const stagedNoteEpoch = noteEditEpoch;
    try {
      await syncInstruction(); await flushGeneralNote(); await flushSectionNotes();
      instructionQueue=instructionQueue.then(async()=>{
        const payload=await requestJson('/api/revise',{recordId:currentRecord(),note:submitted,priorNote:savedNote});
        if(payload.noChange){revisionStatus.textContent=payload.status;return false;}
        if(!payload.revisionReady || payload.recordId!==currentRecord() || payload.instruction!==submitted || !/^[A-Za-z0-9_-]{32}$/.test(payload.pendingRevisionToken) || JSON.stringify(payload.request)!==JSON.stringify(revisionRequest))throw Error(payload.error || 'Revision staging was not confirmed');
        syncedInstruction=submitted;pendingRevisionToken=payload.pendingRevisionToken;proposalId=null;proposalStale=instruction.value!==submitted || noteEditEpoch!==stagedNoteEpoch;invalidateFormCache();markWorkDirty();return true;
      });
      const staged=await instructionQueue;
      if(staged && !stopRequested)await generateRevision();
    }catch(error){showFailure(revisionStatus,error,'Revision could not be prepared. Current brief and typing kept. You can revise again.');}
    finally{reviewBusy=false;controls();}
  });
  document.querySelector('[data-stop-revision]')?.addEventListener('click',()=>{
    if(!reviewBusy)return;stopRequested=true;revisionStatus.textContent='Stopping revision. Current brief kept.';
    if(revisionOperation && !cancelSettlement)cancelSettlement=requestJson('/api/cancel',revisionOperation).catch(error=>{revisionStatus.textContent=error.message;}).finally(()=>{cancelSettlement=null;});
  });
  document.querySelector('[data-apply-revision]')?.addEventListener('click',async()=>{
    if(reviewBusy || !proposalId || proposalStale || instruction.value!==proposalInstruction || noteIsDirty() || notesChangedForProposal() || !canStartRevision())return;
    reviewBusy=true;controls();const submitted=instruction.value;
    try{
      await syncInstruction();
      const result=await requestJson('/api/apply-revision',{recordId:currentRecord(),proposalId,pendingRevisionToken,instruction:submitted});
      if(result.applied!==true || !/^c3_[a-f0-9]{24}$/.test(result.recordId) || typeof result.html!=='string' || result.savedNote!==savedNote)throw Error(result.error || 'Apply was not confirmed');
      const noteSections=['Situation for this audience','Opening','Questions','Useful close'];
      const changedLabels=['Proposed objective','Situation for this audience','Opening','Questions','Useful close','Risks and unknowns','Warnings','Evidence','Temporal outcome'];
      if(!result.sectionNotes || typeof result.sectionNotes!=='object' || Array.isArray(result.sectionNotes) || !Object.entries(result.sectionNotes).every(([key,value])=>noteSections.includes(key) && typeof value==='string' && value.length<=1000) || !Array.isArray(result.changedSections) || !result.changedSections.every(label=>changedLabels.includes(label)))throw Error('Apply acknowledgement incomplete');
      const parsed=new DOMParser().parseFromString(result.html,'text/html');
      if(parsed.querySelector('[data-note-form]')?.getAttribute('data-record-id')!==result.recordId || Array.from(parsed.querySelectorAll('[data-local-edit][data-section]')).some(form=>form.getAttribute('data-record-id')!==result.recordId))throw Error('Applied display identity inconsistent');
      const regions=Array.from(document.querySelectorAll('[data-generated-region]'));
      const replacements=regions.map(region=>parsed.querySelector('[data-generated-region="'+region.getAttribute('data-generated-region')+'"]'));
      if(replacements.some(region=>!region))throw Error('Applied display incomplete. Reopen this brief; local typing kept.');
      rebindSectionNotes(result.recordId,result.sectionNotes);
      regions.forEach((region,index)=>region.replaceChildren(...Array.from(replacements[index].childNodes)));
      reviewForm.setAttribute('data-record-id',result.recordId);reviewForm.setAttribute('data-revised','true');
      pendingRevisionToken=null;proposalId=null;proposalStale=false;proposalNoteSnapshot=null;syncedInstruction='';
      if(instruction.value===submitted)instruction.value='';else await syncInstruction();
      const original=document.querySelector('[data-revision-original]'); const nextOriginal=parsed.querySelector('[data-revision-original]'); if(original && nextOriginal)original.textContent=nextOriginal.textContent;
      document.querySelector('[data-proposal-comparison]').hidden=true;
      revisionStatus.textContent='Revision applied. Notes kept. Save to retain this version.';markWorkDirty();
    }catch(error){showFailure(revisionStatus,error,'Revision was not applied. Current brief and local typing kept.');}
    finally{reviewBusy=false;controls();}
  });
  document.querySelector('[data-discard-revision]')?.addEventListener('click',async()=>{
    if(reviewBusy || !pendingRevisionToken)return;reviewBusy=true;controls();const submitted=instruction.value;
    try{
      await syncInstruction();
      const result=await requestJson('/api/discard-revision',{recordId:currentRecord(),pendingRevisionToken});
      if(result.discarded!==true || result.recordId!==currentRecord())throw Error(result.error || 'Keep original was not confirmed');
      pendingRevisionToken=null;proposalId=null;proposalStale=false;proposalNoteSnapshot=null;syncedInstruction='';
      if(instruction.value===submitted)instruction.value='';else await syncInstruction();
      document.querySelector('[data-proposal-comparison]').hidden=true;
      revisionStatus.textContent='Original kept. Proposal and instruction discarded; annotations kept.';markWorkDirty();
    }catch(error){revisionStatus.textContent=error.message;}
    finally{reviewBusy=false;controls();}
  });
  document.querySelector('[data-use-recorded-note]')?.addEventListener('click',()=>{
    const exact=document.querySelector('[data-recorded-note]');if(instruction && exact && !reviewBusy){instruction.value=exact.textContent || '';revisionStatus.textContent='Exact recorded correction copied into the instruction.';markWorkDirty();syncInstruction().catch(error=>{revisionStatus.textContent=error.message;});openRevisionSheet('Opening');}
  });
  const flushGeneralNote = async () => {
    if(!correctionNote || correctionNote.value===savedNote)return;
    const submitted=correctionNote.value;const result=await requestJson('/api/note',{recordId:currentRecord(),note:submitted,priorNote:savedNote});
    if(result.savedNote!==submitted)throw Error(result.error || 'Note was not confirmed');savedNote=submitted;markWorkDirty();
  };
  document.querySelector('[data-add-note]')?.addEventListener('click', (event) => { const notes = document.querySelector('#review'); if(!notes || !correctionNote) return; event.preventDefault(); notes.open = true; correctionNote.focus(); });
  const titleForm = document.querySelector('[data-title-form]');
  const titleInput = document.querySelector('[data-title-input]');
  let syncedTitle = titleInput?.value || '';
  let titleBusy = false;
  const flushTitle = async () => {
    if(!titleInput || titleInput.value === syncedTitle) return;
    const submitted = titleInput.value.trim();
    if(!submitted || submitted.length > 160 || /[\\r\\n]/.test(submitted)) throw Error('Use a nonempty, single-line title of up to 160 characters.');
    const state = await requestJson('/api/work-state', {});
    if(state.recordId !== currentRecord() || state.documentId !== workDocumentId || !Number.isSafeInteger(state.workVersion) ||
       typeof state.title === 'string' && state.title !== syncedTitle) throw Error('The title or current work changed elsewhere. Reopen to inspect it; your title is kept here.');
    const result = await requestJson('/api/work/title', {recordId:currentRecord(), title:submitted, workVersion:state.workVersion});
    if(result.title !== submitted || result.workVersion !== state.workVersion + (submitted === syncedTitle ? 0 : 1)) throw Error('Title update was not confirmed.');
    const unchanged = titleInput.value.trim() === submitted;
    syncedTitle = submitted; if(unchanged) titleInput.value = submitted;
    const heading = document.querySelector('[data-work-title]'); if(heading) heading.textContent = submitted;
    titleForm.setAttribute('data-work-version', String(result.workVersion)); markWorkDirty();
  };
  titleForm?.addEventListener('submit', async event => {
    event.preventDefault(); if(titleBusy || saveBusy || reviewBusy) return;
    titleBusy = true; const status = document.querySelector('[data-title-status]');
    try { await flushTitle(); status.textContent = 'Title kept for this session. Save to retain this change.'; }
    catch(error) { showFailure(status,error,'The title could not be kept. Your text is still here.'); }
    finally { titleBusy = false; }
  });
  const showSavedTime = value => {
    const target = document.querySelector('[data-last-saved]');
    if(!target) return;
    if(typeof value !== 'string' || !Number.isFinite(Date.parse(value))) { target.textContent = ''; return; }
    target.textContent = 'Last saved ' + new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'}).format(new Date(value));
  };
  const saveWork = async(copy=false)=>{
    if(saveBusy || titleBusy || reviewBusy || !canStartRevision())return;saveBusy=true;if(workStatus)workStatus.textContent='Saving…';
    try{
      await instructionQueue;await syncInstruction();await flushGeneralNote();await flushSectionNotes();await flushTitle();
      const epoch=workEpoch;
      const displayed={correctionNote:correctionNote?.value || '',sectionNotes:displayedSectionNotes(),instruction:instruction?.value || '',pendingRevisionToken,proposalId,proposalStale:proposalStale || notesChangedForProposal()};
      const state=await requestJson('/api/work-state',{});
      if(state.recordId!==currentRecord() || state.documentId!==workDocumentId)throw Error('Current document changed. Reopen or Save a copy; local text kept.');
      // Versions belong to this exact displayed work, never just the shared session's latest record.
      const snapshot=state.snapshot;
      if(!snapshot || snapshot.correctionNote!==displayed.correctionNote || snapshot.instruction!==displayed.instruction ||
        snapshot.pendingRevisionToken!==displayed.pendingRevisionToken || snapshot.proposalId!==displayed.proposalId ||
        displayed.pendingRevisionToken && snapshot.proposalStale!==displayed.proposalStale && !(displayed.proposalStale && snapshot.proposalStale===false) ||
        !snapshot.sectionNotes || typeof snapshot.sectionNotes!=='object' || Array.isArray(snapshot.sectionNotes) ||
        [...new Set([...Object.keys(snapshot.sectionNotes),...Object.keys(displayed.sectionNotes)])].some(section=>(snapshot.sectionNotes[section] ?? '')!==(displayed.sectionNotes[section] ?? '')))
        throw Error('Document notes or revision changed in another tab. Reopen to inspect the current work; local text kept.');
      // Only explicit Save synchronizes unsent edit history. This carries no annotation text.
      if(displayed.pendingRevisionToken && displayed.proposalStale && !snapshot.proposalStale) {
        const invalidation = {recordId:state.recordId,pendingRevisionToken:displayed.pendingRevisionToken,proposalId:displayed.proposalId,workVersion:state.workVersion};
        const result = await requestJson('/api/revision-invalidate', invalidation);
        if(result.recordId!==invalidation.recordId || result.pendingRevisionToken!==invalidation.pendingRevisionToken || result.proposalId!==invalidation.proposalId || result.proposalStale!==true || result.workVersion!==invalidation.workVersion+1)
          throw Error(result.error || 'Proposal invalidation was not confirmed. Local edits kept.');
        state.workVersion = result.workVersion;
      }
      const result=await requestJson(copy?'/api/save-copy':'/api/save',{recordId:state.recordId,documentId:state.documentId,expectedVersion:state.version,workVersion:state.workVersion});
      if(result.saved!==true || result.workVersion!==state.workVersion || result.recordId!==currentRecord() || !/^doc_[a-f0-9]{24}$/.test(result.documentId) || result.version!==(copy?1:state.version+1) || !copy && result.documentId!==state.documentId)throw Error(result.error || 'Durable save was not confirmed');
      workDocumentId=result.documentId; proposalStale=proposalStale || displayed.proposalStale; controls(); showSavedTime(result.savedAt);
      if(epoch===workEpoch){workDirty=false;workStatus.textContent='Saved';const save=document.querySelector('[data-save-work]');if(save)save.hidden=true;}else workStatus.textContent='Newer edits are unsaved. Save again to retain them.';
      document.querySelector('[data-save-copy]').hidden=true;
    }catch(error){showFailure(workStatus,error,'Save was not confirmed. Local work is kept.');document.querySelector('[data-save-copy]').hidden=!(error.status===409 && error.route==='/api/save');}
    finally{saveBusy=false;}
  };
  document.querySelector('[data-save-work]')?.addEventListener('click',()=>saveWork());
  document.querySelector('[data-save-copy]')?.addEventListener('click',()=>saveWork(true));
  document.querySelectorAll?.('[data-reopen-work]').forEach(button=>button.addEventListener('click',async()=>{
    const status=document.querySelector('[data-work-list-status]');
    const discardUnsaved=button.getAttribute('data-replaces-unsaved')==='true';
    if(discardUnsaved && !(typeof window.confirm==='function' && window.confirm('Replace the current unsaved brief with this saved version? Save a copy first if you need the current work.')))return;
    try{const result=await requestJson('/api/reopen',{documentId:button.getAttribute('data-reopen-work'),discardUnsaved,workVersion:Number(button.getAttribute('data-work-version'))});if(!result.reopened)throw Error(result.error || 'Reopen failed');window.location.assign('/?draft=1');}
    catch(error){showFailure(status,error,'The saved brief could not be reopened. Current work is kept.');}
  }));
  const priorDeparture=confirmDirtyNavigation;
  confirmDirtyNavigation=()=>{
    if(saveBusy || titleBusy || reviewBusy)return false;
    if(!priorDeparture())return false;
    if(workDirty && workControls?.getAttribute('data-store-available')==='true'){workNavigationApproved=reviewNavigationApproved || typeof window.confirm==='function' && window.confirm('Leave with unsaved document changes? Save first to retain this version.');return workNavigationApproved;}
    return true;
  };
  window.addEventListener?.('beforeunload',event=>{if(saveBusy || workDirty && !workNavigationApproved && workControls?.getAttribute('data-store-available')==='true' || instruction && instruction.value!==syncedInstruction){event.preventDefault();event.returnValue='';}});
`;
