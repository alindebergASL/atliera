// Subprocess used only by persistence regressions. Authored synthetic data, no provider.
import { writeSync } from 'node:fs';
import { LocalWorkStore } from '../../src/c3/work-store.ts';
import { syntheticWorkshopContext, syntheticMeetingCandidate, syntheticMeetingRequest } from '../fixtures/c3-workshop.ts';
import { createC3ModelRequest, createGenerationRecord } from '../../src/c3/draft.ts';
const context=syntheticWorkshopContext();
const record=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest,null,'5'),syntheticMeetingCandidate(context),context);
const [root,stage,id,version]=process.argv.slice(2);
const store=new LocalWorkStore({root:root!,principal:'operator-one',fault(at){
  if(at===stage) {
    writeSync(1,'SAVE_PAUSED\n');
    // Keep the synchronous Save inside the fault point until the parent kills us.
    // stdout is a pipe: write small readiness bytes synchronously before blocking.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
  }
}},context);
store.save(id!,Number(version),{record,records:[record],correctionNote:'Child note',sectionNotes:{},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1});
