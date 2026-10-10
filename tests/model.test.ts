import test from 'node:test';
import assert from 'node:assert/strict';
import {newFlat,makeMember,mutate,present,laundryEvents,validDate} from '../server/model.ts';
const week='2026-09-14',now='2026-09-15';
function flat(){const s=newFlat('f','owner','House 402','402','Om');s.members.push(makeMember('r2','Aarav','resident'),makeMember('r3','Rohan','resident'),makeMember('cook','Meena','cook'));return s}
const run=(s:any,id:string,b:any)=>mutate(s,id,{week,...b},now);
function planned(){return run(flat(),'cook',{action:'plan'})}
function laundry(){return run(flat(),'owner',{action:'laundry_schedule',start:now,days:[1,3,5],dryOffset:1,washOrder:['owner','r2','r3'],dryOrder:['r3','owner','r2']})}
test('cook can start menu; only residents receive dishwashing duties',()=>{const s=planned();assert.equal(s.meals.length,21);assert.equal(s.duties.length,14);assert(!s.duties.some(d=>d.assignee==='cook'));assert.equal(run(s,'cook',{action:'plan'}).meals.length,21)});
test('resident-only majority; duplicate support cannot inflate votes',()=>{let s=planned();s=run(s,'owner',{action:'request',day:2,slot:1,title:'Dosa',reason:''});const id=s.requests[0].id;assert.throws(()=>run(s,'cook',{action:'vote',id,support:true}),/residents/);assert.throws(()=>run(s,'cook',{action:'apply',id}),/half/);s=run(s,'r2',{action:'vote',id,support:true});s=run(s,'r2',{action:'vote',id,support:true});assert.equal(s.requests[0].supporters.length,2);s=run(s,'cook',{action:'apply',id});assert.equal(s.meals.find(m=>m.day===2&&m.slot===1).title,'Dosa');assert.equal(s.requests[0].status,'applied')});
test('cook suggestions do not count as resident votes',()=>{const s=run(planned(),'cook',{action:'request',day:0,slot:1,title:'Idli'});assert.deepEqual(s.requests[0].supporters,[])});
test('role changes cannot be injected into profile updates',()=>{const s=run(flat(),'r2',{action:'profile',name:'A',diet:'Vegetarian',role:'cook',likes:'',avoid:'',allergies:''});assert.equal(s.members[1].role,'resident')});
test('unrelated identity cannot read or mutate a flat',()=>{assert.throws(()=>present(flat(),'outsider',week,{code:'a',cook_code:'b'}),/belong/);assert.throws(()=>run(flat(),'outsider',{action:'plan'}),/belong/)});
test('cook has no laundry or resident/cook invitation codes',()=>{const s=laundry();const v=present(s,'cook',week,{code:'resident',cook_code:'cook'});assert.equal(v.flat.code,undefined);assert.equal(v.flat.cookCode,undefined);assert.deepEqual(v.laundry,[]);assert.equal(v.laundryConfig,null);assert.throws(()=>run(s,'cook',{action:'laundry_schedule'}),/creator/)});
test('a resident cannot manage someone else’s dish completion',()=>{let s=planned();const duty=s.duties.find(d=>d.assignee==='r3');assert.throws(()=>run(s,'r2',{action:'duty',id:duty.id,done:true}),/assigned/);s=run(s,'r3',{action:'duty',id:duty.id,done:true});assert.equal(s.duties.find(d=>d.id===duty.id).done,true)});
test('laundry order starts from first eligible date and cycles across weeks',()=>{const s=laundry();const events=laundryEvents(s,week,'2026-09-27');const wash=events.filter(x=>x.kind==='wash'),dry=events.filter(x=>x.kind==='dry');assert.deepEqual(wash.map(x=>x.assignee),['owner','r2','r3','owner','r2','r3']);assert.equal(wash[0].date,now);assert.equal(dry[0].date,'2026-09-16');assert.equal(dry[0].assignee,'r3')});
test('manual reassignment affects one occurrence only',()=>{let s=laundry();const turns=laundryEvents(s,week,'2026-09-27').filter(x=>x.kind==='wash');s=run(s,'owner',{action:'laundry',id:turns[0].id,date:turns[0].date,assignee:'r3',note:'Swap'});const after=laundryEvents(s,week,'2026-09-27').filter(x=>x.kind==='wash');assert.equal(after[0].assignee,'r3');assert.deepEqual(after.slice(1),turns.slice(1));assert.throws(()=>run(s,'cook',{action:'laundry',id:turns[0].id,date:turns[0].date,assignee:'cook'}),/residents/)});
test('completing current turn updates next person and persists undo',()=>{let s=laundry();const first=laundryEvents(s,now,'2026-09-21').find(x=>x.kind==='wash');s=run(s,'owner',{action:'laundry',id:first.id,date:first.date,done:true});assert.equal(present(s,'owner',week,{code:'a',cook_code:'b'},now).laundryNext.wash[0].assignee,'r2');s=run(s,'owner',{action:'laundry',id:first.id,date:first.date,done:false});assert.equal(present(s,'owner',week,{code:'a',cook_code:'b'},now).laundryNext.wash[0].assignee,'owner')});
test('future schedule preserves earlier completed turns',()=>{let s=laundry();const first=laundryEvents(s,now,now)[0];s=run(s,'owner',{action:'laundry',id:first.id,date:first.date,done:true});s=run(s,'owner',{action:'laundry_schedule',start:'2026-09-22',days:[1,3,5],dryOffset:0,washOrder:['r2','owner','r3'],dryOrder:['owner','r2','r3']});assert.equal(laundryEvents(s,now,now)[0].done,true);assert.equal(laundryEvents(s,'2026-09-22','2026-09-22').find(x=>x.kind==='wash').assignee,'r2')});
test('invalid schedules and dates cannot corrupt state',()=>{const s=flat(),before=structuredClone(s);assert.throws(()=>run(s,'owner',{action:'laundry_schedule',start:now,days:[],dryOffset:1,washOrder:[],dryOrder:[]}),/day/);assert.deepEqual(s,before);assert.throws(()=>validDate('2026-02-31'),/valid date/)});


test('leaving one flat removes access without changing a second flat or source state',async()=>{
 const {leaveFlat}=await import('../server/model.ts');const s=planned(),other=flat(),before=structuredClone(s),otherBefore=structuredClone(other);
 const next=leaveFlat(s,'r2',now);
 assert.deepEqual(s,before);assert.deepEqual(other,otherBefore);
 assert(!next.members.some(m=>m.id==='r2'));assert(next.formerMembers?.some(m=>m.id==='r2'));
 assert.throws(()=>present(next,'r2',week,{code:'a',cook_code:'b'}),/belong/);
 assert(!next.duties.some(d=>!d.done&&d.assignee==='r2'&&d.day>=1));
});
test('owners and outsiders cannot leave through member removal',async()=>{
 const {leaveFlat}=await import('../server/model.ts');assert.throws(()=>leaveFlat(flat(),'owner',now),/Transfer ownership/);assert.throws(()=>leaveFlat(flat(),'outsider',now),/belong/);
});
test('leaving preserves old laundry history and removes pending future assignments',async()=>{
 const {leaveFlat}=await import('../server/model.ts');let s=laundry();
 const prior=laundryEvents(s,now,'2026-09-27');const completed=prior.find(x=>x.kind==='wash'&&x.assignee==='r2')!;
 s=run(s,'owner',{action:'laundry',id:completed.id,date:completed.date,done:true});
 const next=leaveFlat(s,'r2','2026-09-16');
 assert.deepEqual(laundryEvents(next,now,now),laundryEvents(s,now,now));
 const future=laundryEvents(next,'2026-09-16','2026-10-30');assert(!future.some(x=>!x.done&&x.assignee==='r2'));
 assert(future.some(x=>x.done&&x.washDate===completed.washDate&&x.kind==='wash'&&x.assignee==='r2'));
});
test('cook leaving keeps laundry schedules intact and removes vote membership',async()=>{
 const {leaveFlat}=await import('../server/model.ts');const s=laundry(),next=leaveFlat(s,'cook',now);assert.deepEqual(next.laundrySchedules,s.laundrySchedules);assert.equal(next.members.length,3);
});
