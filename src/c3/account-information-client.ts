/** Uses the same account/session request guard as work editing; never invokes research or generation. */
export const INFORMATION_CLIENT_SCRIPT = `
(() => {
  if(!document.querySelector('[data-account-information]')?.hasAttribute?.('data-account-information') && !document.querySelector('[data-information-attachments]')?.hasAttribute?.('data-information-attachments'))return;
  const informationDirtyForms = new Set();
  let informationBusy = false;
  const informationSearch = document.querySelector('[data-information-search]');
  const filterInformation = () => {
    if(!informationSearch)return;
    informationSearch.value=informationSearch.value.slice(0,200);
    const query=informationSearch.value.trim().toLocaleLowerCase();
    const panel=informationSearch.closest('[data-account-information]');
    const cards=[...panel.querySelectorAll('[data-information-item]')];
    let matches=0;
    cards.forEach(card=>{
      const text=[...card.querySelectorAll('[data-information-search-text]')].map(node=>node.textContent).join(' ').toLocaleLowerCase();
      card.hidden=!!query&&!text.includes(query);if(!card.hidden)matches++;
    });
    panel.querySelector('[data-information-search-count]').textContent=matches+' of '+cards.length+' information cards'+(matches===0?' · No matches. Clear or change your search.':'');
  };
  informationSearch?.addEventListener('input',filterInformation);
  informationSearch?.addEventListener('search',filterInformation);
  document.querySelector('[data-information-search-clear]')?.addEventListener('click',()=>{informationSearch.value='';filterInformation();informationSearch.focus();});
  const bindInformation = () => {
    document.querySelectorAll?.('[data-information-form]').forEach(form => {
      if(form.dataset.bound) return; form.dataset.bound='true';
      const field = name => form.elements.namedItem(name);
      const showFields = () => form.querySelectorAll('[data-information-fields]').forEach(region => {region.hidden=!region.getAttribute('data-information-fields').split(' ').includes(field('action').value);});
      form.addEventListener('change',showFields);showFields();
      form.addEventListener('input',()=>informationDirtyForms.add(form));
      form.querySelector('[data-information-cancel]')?.addEventListener?.('click',()=>{
        if(informationBusy)return;
        if(informationDirtyForms.has(form)&&!(typeof window.confirm==='function'&&window.confirm('Discard this unsaved information review?')))return;
        form.reset();showFields();informationDirtyForms.delete(form);form.querySelector('[data-information-status]').textContent='';
        const detail=form.closest('[data-information-detail]');detail.open=false;detail.querySelector('summary')?.focus();
      });
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(informationBusy)return;
        const status=form.querySelector('[data-information-status]');
        const action=field('action').value;
        const selected=[...form.querySelectorAll('[name="evidence"]:checked')].filter(e=>action==='assess'||e.closest('[data-information-evidence-choice]').getAttribute('data-existing')==='true');
        const evidenceIds=selected.map(e=>e.value);
        const additionalEvidenceIds=selected.filter(e=>e.closest('[data-information-evidence-choice]').getAttribute('data-existing')!=='true').map(e=>e.value);
        if(['validate','resolve'].includes(action)&&!evidenceIds.length&&!field('firsthand').value.trim()){
          status.textContent='Select an attached evidence passage or describe your firsthand basis before saving. Typed reasoning kept.';status.focus?.();field('firsthand').focus?.();return;
        }
        informationBusy=true;status.textContent='Saving information review…';
        const controls=[...form.querySelectorAll('input,textarea,select,button')];
        controls.forEach(control=>{control.disabled=true;});
        const change={action,reason:field('reason').value};
        if(action==='restore-conflict'){try{Object.assign(change,JSON.parse(field('restoreTarget').value));}catch{/* Server refuses a missing target; typed reasoning is kept. */}}
        if(action==='resolve')Object.assign(change,{contradictionIds:[...form.querySelectorAll('[name="contradiction"]:checked')].map(e=>e.value),text:field('resolutionText').value,entity:field('entity').value,timeScope:field('timeScope').value,category:field('resolutionCategory').value,basis:field('resolutionBasis').value,firsthand:field('firsthand').value,evidenceIds});
        if(action==='validate')Object.assign(change,{firsthand:field('firsthand').value,evidenceIds});
        if(action==='edit')Object.assign(change,{text:field('text').value,entity:field('entity').value,timeScope:field('timeScope').value});
        if(action==='assess-time')Object.assign(change,{evidenceIds,entity:field('entity').value,timeScope:field('timeScope').value,temporal:field('temporal').value,basis:field('temporalBasis').value});
        if(action==='assess')Object.assign(change,{evidenceIds,effect:field('effect').value,entity:field('entity').value,timeScope:field('timeScope').value,independence:field('independence').value,origins:selected.flatMap(e=>{const row=e.closest('[data-information-evidence-choice]');const group=row.querySelector('[data-origin-group]').value,basis=row.querySelector('[data-origin-basis]').value;return group||basis?[{evidenceId:e.value,group,basis}]:[];})});
        try {
          const version=Number(form.dataset.version), id=form.dataset.id;
          const result=await requestJson('/api/information/change',{id,expectedVersion:version,change,additionalEvidenceIds:action==='assess'?additionalEvidenceIds:[]});
          if(result.saved!==true||result.item?.id!==id||result.item.version!==version+(result.noChange?0:1))throw Error('Information save was not confirmed. Typed reasoning kept.');
          const parsed=new DOMParser().parseFromString(result.html,'text/html');const next=parsed.querySelector('[data-information-item="'+id+'"]');if(!next)throw Error('Saved information display unavailable. Reopen to inspect the saved version.');
          informationDirtyForms.delete(form);const old=form.closest('[data-information-item]');old.replaceWith(document.importNode(next,true));bindInformation();
          const current=document.getElementById(id);current.querySelector('[data-information-detail]').open=true;const message=current.querySelector('[data-information-status]');message.textContent=result.noChange?'No change. Existing saved review kept.':'Information review saved · version '+result.item.version;message.setAttribute('tabindex','-1');if(current.hidden){const count=document.querySelector('[data-information-search-count]');count.textContent=message.textContent+'. '+count.textContent;informationSearch.focus();}else{message.focus();}
        }catch(error){status.textContent=error.message||'Save was not confirmed. Typed reasoning kept.';status.focus?.();}
        finally{controls.forEach(control=>{control.disabled=false;});informationBusy=false;}
      });
    });
    filterInformation();
  };
  bindInformation();
  document.addEventListener('click',async event=>{
    const button=event.target?.closest?.('[data-information-work]');if(!button||informationBusy||saveBusy||reviewBusy)return;
    event.preventDefault();informationBusy=true;const status=button.closest('article').querySelector('[data-information-work-status]');
    try{
      const panel=button.closest('[data-account-information],[data-information-attachments]');
      const state=await requestJson('/api/work-state',{});
      const recordId=panel.getAttribute('data-record-id')||currentRecord();
      if(state.recordId!==recordId||state.documentId!==workDocumentId)throw Error('Displayed brief changed. Reopen before changing working context.');
      if(panel.matches('[data-information-attachments]')&&JSON.stringify(state.snapshot.informationAttachments||[])!==JSON.stringify(displayedInformationAttachments))throw Error('Working context changed in another tab. Reopen before editing.');
      const result=await requestJson('/api/work/information',{action:button.getAttribute('data-information-work'),id:button.dataset.id,informationVersion:Number(button.dataset.informationVersion),workVersion:state.workVersion,recordId});
      if(!Array.isArray(result.attachments)||!Number.isSafeInteger(result.workVersion)||result.workVersion<state.workVersion||result.workVersion>state.workVersion+1||result.saved!==false)throw Error('Working context update was not confirmed.');
      if(panel.matches('[data-information-attachments]')){
        const parsed=new DOMParser().parseFromString(result.html,'text/html');const replacement=parsed.querySelector('[data-information-attachments]');if(!replacement)throw Error('Working context display unavailable.');
        displayedInformationAttachments=result.attachments;panel.replaceWith(document.importNode(replacement,true));if(!result.noChange)markWorkDirty();
        const next=document.querySelector('[data-information-attachments]');next.setAttribute('tabindex','-1');next.focus();
      }else{
        status.textContent=result.noChange?'Working context unchanged. Inspect the brief for its Save status. ':'Working context updated locally. Save the brief to retain this version. ';
        const briefStatus=document.querySelector('[data-working-brief-status]');
        if(briefStatus&&!result.noChange)briefStatus.textContent='Pending brief changes · use Save in the brief to retain them.';
        const link=document.createElement('a');link.href=accountUrl('/?draft=1');link.textContent='Return to brief and Save';status.append(link);
      }
    }catch(error){status.textContent=error.message||'Working context update was not confirmed.';}
    finally{informationBusy=false;}
  });
  const informationDeparture=confirmDirtyNavigation;
  confirmDirtyNavigation=()=>{if(informationBusy)return false;if(informationDirtyForms.size&&!(typeof window.confirm==='function'&&window.confirm('Leave with unsaved information reasoning? Copy it or save the review first.')))return false;return informationDeparture();};
  window.addEventListener?.('beforeunload',event=>{if(informationBusy||informationDirtyForms.size){event.preventDefault();event.returnValue='';}});
  if(/^#info_[a-f0-9]{64}$/.test(window.location.hash)){const item=document.getElementById(window.location.hash.slice(1));if(item){item.querySelector('[data-information-detail]').open=true;item.setAttribute('tabindex','-1');item.focus();}}
})();
`;
