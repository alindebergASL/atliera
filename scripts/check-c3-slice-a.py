import json,sys,time,traceback
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
BASE=sys.argv[1]; OUT=Path(sys.argv[2]);OUT.mkdir(parents=True,exist_ok=True)
assert urlparse(BASE).hostname=='127.0.0.1','Synthetic loopback preview only'
rows=[];errors=[]
def shot(pg,name):
 pg.screenshot(path=str(OUT/(name+'.png')),full_page=True)
def generate(pg):
 pg.goto(BASE+'/?prepare=1');pg.locator('[data-generate] button[type=submit]').click();expect(pg.locator('h1')).to_have_text('Your meeting brief')
def note(pg):return pg.locator('[data-local-edit][data-section="Opening"]')
def open_note(pg):
 pg.get_by_text('Note or correction for Opening',exact=True).click();return note(pg)
def keep(f,text):
 f.locator('textarea').fill(text);f.locator('button[type=submit]').click();expect(f.locator('[data-local-status]')).to_contain_text('kept for this session')
def request_result(pg,pattern,action):
 with pg.expect_response(pattern) as r:action()
 return {'status':r.value.status,'body':{k:v for k,v in r.value.json().items() if k!='html'}}
def cs01(c):
 a=c.new_page();b=c.new_page();generate(a);b.goto(BASE+'/?draft=1')
 a.locator('[data-correction-note]').fill('A saved important constraint');a.locator('[data-note-form] button[type=submit]').click();expect(a.locator('[data-review-status]')).to_contain_text('Note kept')
 b.locator('[data-correction-note]').fill('B stale replacement');r=request_result(b,'**/api/note',lambda:b.locator('[data-note-form] button[type=submit]').click());shot(b,'CS01-stale-note')
 assert r['status']==409,r
 assert b.locator('[data-correction-note]').input_value()=='B stale replacement'
 a.reload();assert a.locator('[data-correction-note]').input_value()=='A saved important constraint'
 return {'stale_status':r['status'],'saved_readback':'A saved important constraint','typed_text_preserved':True}
def cs02(c):
 a=c.new_page();b=c.new_page();generate(a);b.goto(BASE+'/?draft=1');open_note(a).locator('textarea').fill('A unsent OLD BASELINE');keep(open_note(b),'B current saved section');a.reload();f=note(a)
 current=f.locator('textarea').input_value();body=a.locator('body').inner_text();shot(a,'CS02-recovery')
 if current=='A unsent OLD BASELINE':
  r=request_result(a,'**/api/section-note',lambda:f.locator('button[type=submit]').click());assert r['status']==409,r
 else:
  assert current=='B current saved section',current
  assert 'A unsent OLD BASELINE' in body,'Unsubmitted text must remain recoverable'
 b.reload();assert note(b).locator('textarea').input_value()=='B current saved section'
 return {'restored_editor':current,'saved_readback':'B current saved section','stale_text_recoverable':True}
def cs03(c):
 a=c.new_page();b=c.new_page();generate(a);b.goto(BASE+'/?draft=1');a.goto(BASE+'/?prepare=1')
 b.locator('[data-correction-note]').fill('Focus the close on confirming an owner for the follow-up.');b.locator('[data-revise]').click();expect(b.locator('h1')).to_have_text('Prepare a meeting')
 before=c.request.get(BASE+'/healthz').json();r=request_result(a,'**/api/generate',lambda:a.locator('[data-generate] button[type=submit]').click());shot(a,'CS03-stale-prepare');assert r['status']==409,r
 after=c.request.get(BASE+'/healthz').json();assert before['generationAttempted']==after['generationAttempted'],[before,after]
 b.locator('[data-generate] button[type=submit]').click();expect(b.locator('h1')).to_have_text('Your meeting brief')
 assert b.locator('[data-correction-note]').input_value()=='Focus the close on confirming an owner for the follow-up.'
 return {'stale_status':r['status'],'stale_attempt_delta':0,'visible_revision_replay':'PASS'}
def cs04(c):
 a=c.new_page();b=c.new_page();a.goto(BASE+'/?prepare=1');b.goto(BASE+'/?prepare=1');original=b.locator('#audience').input_value();a.locator('#audience').fill('STALE CANCEL MUST NOT REPLACE FORM')
 with b.expect_request('**/api/generate'):b.locator('[data-generate] button[type=submit]').click()
 disabled=a.locator('[data-cancel]').is_disabled()
 if not disabled:a.locator('[data-cancel]').click()
 expect(b.locator('h1')).to_have_text('Your meeting brief');shot(b,'CS04-other-tab-survives')
 fresh=c.new_page();fresh.goto(BASE+'/?prepare=1');assert fresh.locator('#audience').input_value()!='STALE CANCEL MUST NOT REPLACE FORM'
 return {'idle_cancel_disabled':disabled,'other_tab_generation':'completed','server_form_preserved':True}
def cs05(c):
 a=c.new_page();generate(a)
 a.locator('[data-correction-note]').fill('\nLeading global note');a.locator('[data-note-form] button[type=submit]').click();expect(a.locator('[data-review-status]')).to_contain_text('Note kept');a.reload();assert a.locator('[data-correction-note]').input_value()=='\nLeading global note'
 f=open_note(a);keep(f,'\nLeading section note');a.reload();f=open_note(a);assert f.locator('textarea').input_value()=='\nLeading section note'
 r=request_result(a,'**/api/section-note',lambda:f.locator('button[type=submit]').click());assert r['status']==200 and r['body']['noChange'],r
 r=request_result(a,'**/api/section-note',lambda:(f.locator('textarea').fill(''),f.locator('button[type=submit]').click()));assert r['status']==200,r
 a.goto(BASE+'/?kind=strategy');a.get_by_text('Edit Options and tradeoffs',exact=True).click();f=a.locator('[data-local-edit][data-section="options"]');f.locator('textarea').fill('\nLeading planning note');f.locator('button[type=submit]').click();expect(f.locator('[data-local-status]')).to_contain_text('version 1');a.reload();a.get_by_text('Edit Options and tradeoffs',exact=True).click();f=a.locator('[data-local-edit][data-section="options"]');assert f.locator('textarea').input_value()=='\nLeading planning note'
 r=request_result(a,'**/api/planning/strategy',lambda:f.locator('button[type=submit]').click());assert r['status']==200 and r['body']['noChange'],r
 shot(a,'CS05-leading-newline');return {'global_section_planning_newline':'preserved','section_nochange_and_clear':'PASS','planning_nochange':'PASS'}
def cs06(c):
 c.add_init_script("Storage.prototype.setItem=function(){throw new DOMException('Synthetic storage fault','QuotaExceededError')}")
 a=c.new_page();generate(a);f=open_note(a);f.locator('textarea').fill('UNSAVED UNCACHED SECTION');expect(f.locator('[data-local-status]')).to_contain_text('Reload recovery unavailable')
 requests=[];dialogs=[];a.on('request',lambda r:requests.append(r.url) if '/api/revise' in r.url else None);a.on('dialog',lambda d:(dialogs.append(d.type),d.dismiss()))
 a.locator('[data-correction-note]').fill('Focus the close on confirming an owner for the follow-up.');a.locator('[data-revise]').click();a.wait_for_timeout(150)
 shot(a,'CS06-cancel-departure');assert a.locator('h1').inner_text()=='Your meeting brief';assert f.locator('textarea').input_value()=='UNSAVED UNCACHED SECTION';assert requests==[],requests
 return {'dialogs':dialogs,'revision_requests':len(requests),'dirty_text_preserved':True}
def cs06_latch(c):
 a=c.new_page();generate(a);f=open_note(a);f.locator('textarea').fill('Dirty section retained after veto');a.locator('[data-correction-note]').fill('Focus the close on confirming an owner for the follow-up.')
 dialogs=[]
 def answer(d):
  dialogs.append(d.message)
  if len(dialogs)%2: d.accept()
  else: d.dismiss()
 a.on('dialog',answer);a.get_by_role('link',name='Account Intel',exact=True).click();assert len(dialogs)==2;expect(a.locator('h1')).to_have_text('Your meeting brief')
 a.get_by_role('link',name='Account Intel',exact=True).click();assert len(dialogs)==4,'A veto must clear remembered local approval';expect(a.locator('h1')).to_have_text('Your meeting brief')
 held=[];requests=[];a.route('**/api/section-note',lambda route:held.append(route));a.on('request',lambda req:requests.append(req.url) if '/api/revise' in req.url else None)
 f.locator('button[type=submit]').click();expect(f.locator('[data-local-status]')).to_contain_text('Keeping session edit');assert len(held)==1
 a.locator('[data-revise]').click();a.wait_for_timeout(100);shot(a,'CS06-latch-pending');assert not requests;expect(a.locator('h1')).to_have_text('Your meeting brief')
 held[0].continue_();expect(f.locator('[data-local-status]')).to_contain_text('kept for this session')
 return {'local_approval_reset_after_global_veto':True,'pending_save_blocks_revision':True,'revision_requests':len(requests),'delayed_actual_save':'acknowledged'}
def cancelcopy(c):
 a=c.new_page();a.goto(BASE+'/?prepare=1')
 with a.expect_request('**/api/generate'):a.locator('[data-generate] button[type=submit]').click()
 a.locator('[data-cancel]').click();expect(a.locator('[data-status]')).to_contain_text('Local')
 text=a.locator('[data-status]').inner_text();shot(a,'cancel-local-feedback');assert 'cannot be confirmed' not in text.lower() and 'unknown' not in text.lower(),text
 return {'synthetic_cancel_status':text}
def focus(c):
 a=c.new_page();generate(a);a.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
 state=a.evaluate("({scrollY,headingTop:document.querySelector('h1').getBoundingClientRect().top,focus:document.activeElement.tagName,width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})");shot(a,'mobile-heading-focus')
 assert state['scrollY']==0 and state['headingTop']>=0 and state['focus']=='H1',state
 assert state['scrollWidth']<=state['width'],state
 a.locator('[data-evidence-link]').first.click();assert a.evaluate('document.activeElement.tagName')=='SUMMARY';a.locator('[data-evidence-return]:visible').first.click()
 return state
cases=[('CS01',cs01),('CS02',cs02),('CS03',cs03),('CS04',cs04),('CS05',cs05),('CS06',cs06),('CS06-latch',cs06_latch),('cancel-copy',cancelcopy),('focus',focus)]
if len(sys.argv)>3:
 assert sys.argv[3] in dict(cases),'Unknown regression case'
 cases=[entry for entry in cases if entry[0]==sys.argv[3]]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 guard=b.new_context();pg=guard.new_page();pg.goto(BASE);expect(pg.locator('.recorded-mode').first).to_contain_text('Synthetic local preview');guard.close()
 for id,fn in cases:
  c=b.new_context(viewport={'width':390,'height':844} if id=='focus' else {'width':1280,'height':900})
  c.on('page',lambda pg:pg.on('pageerror',lambda e:errors.append(str(e))))
  try:result=fn(c);row={'id':id,'status':'PASS','evidence':result}
  except Exception as e:row={'id':id,'status':'FAIL','error':str(e),'trace':traceback.format_exc()}
  rows.append(row);(OUT/'results.json').write_text(json.dumps({'base':BASE,'cases':rows,'pageErrors':errors},indent=2));print(json.dumps(row),flush=True);c.close()
 b.close()
failed=sum(x['status']=='FAIL' for x in rows);print(json.dumps({'cases':len(rows),'failed':failed,'pageErrors':len(errors)}));sys.exit(1 if failed or errors else 0)
