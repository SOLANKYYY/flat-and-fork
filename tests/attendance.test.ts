import test from 'node:test';
import assert from 'node:assert/strict';
import {newFlat,makeMember,mutate,laundryEvents,pendingToday,present,leaveFlat} from '../server/model.ts';
const now='2026-10-09',week='2026-10-05';
function flat(){const s=newFlat('flat','owner','Our home','1','Owner');s.members.push(makeMember('r2','Resident Two','resident'),makeMember('r3','Resident Three','resident'),makeMember('cook','Cook','cook'));return s;}
function tasks(){let s=flat();s=mutate(s,'owner',{action:'plan',week},now);s=mutate(s,'owner',{action:'laundry_schedule',start:now,days:[4,5],dryOffset:0,washOrder:['r2','owner','r3'],dryOrder:['r2','r3','owner']},now);for(const d of s.duties)if(d.day===4)d.assignee='r2';return s;}
const away=(s:any,uid:string,to='owner')=>mutate(s,uid,{action:'attendance',date:now,away:true,transfers:pendingToday(s,uid,now).map(t=>({key:t.key,assignee:to}))},now);
test('profile validates optional contact details without changing another member',()=>{
 const s=flat();const next=mutate(s,'r2',{action:'profile',name:'Updated name',diet:'Vegetarian',phone:'+91 (98765) 43210',age:'24'},now);
 assert.equal(next.members[1].phone,'+919876543210');assert.equal(next.members[1].age,24);assert.equal(next.members[1].profileCompleted,true);assert.deepEqual(next.members[0],s.members[0]);
 assert.throws(()=>mutate(s,'r2',{action:'profile',name:'X',diet:'Vegetarian',phone:'javascript:alert(1)'},now),/phone number/);
 for(const age of [-1,121,'1.5',true])assert.throws(()=>mutate(s,'r2',{action:'profile',name:'X',diet:'Vegetarian',age},now),/age/);
 const cleared=mutate(next,'r2',{action:'profile',name:'X',diet:'Vegetarian',phone:'',age:''},now);assert.equal(cleared.members[1].phone,'');assert.equal(cleared.members[1].age,null);
});
test('away requires all kitchen, washing and drying duties, saves atomically and preserves tomorrow',()=>{
 const s=tasks(),before=structuredClone(s),today=pendingToday(s,'r2',now);assert.equal(today.length,4);
 assert.throws(()=>mutate(s,'r2',{action:'attendance',date:now,away:true,transfers:[]},now),/every unfinished/);assert.deepEqual(s,before);
 const next=away(s,'r2');assert.equal(next.members[1].awayDate,now);assert.equal(pendingToday(next,'r2',now).length,0);
 assert.deepEqual(laundryEvents(next,'2026-10-10','2026-10-20'),laundryEvents(s,'2026-10-10','2026-10-20'));
 assert.deepEqual(next.duties.filter(d=>d.day!==4),s.duties.filter(d=>d.day!==4));
});
test('forged, duplicate, self, cook, foreign and absent recipients cannot satisfy handover',()=>{
 const s=tasks();s.members[2].awayDate=now;
 for(const recipient of ['r2','r3','cook','outsider'])assert.throws(()=>away(s,'r2',recipient));
 const transfers=pendingToday(s,'r2',now).map(t=>({key:t.key,assignee:'owner'}));transfers[0].key='duty:forged';assert.throws(()=>mutate(s,'r2',{action:'attendance',date:now,away:true,transfers},now),/Choose another/);
 transfers[0].key=transfers[1].key;assert.throws(()=>mutate(s,'r2',{action:'attendance',date:now,away:true,transfers},now),/every unfinished/);
});
test('absence expires tomorrow, stale day is rejected, and returning does not undo transfers',()=>{
 const s=away(tasks(),'r2');const next=mutate(s,'r2',{action:'attendance',date:now,away:false},now);assert.equal(next.members[1].awayDate,undefined);assert.deepEqual(next.duties,s.duties);
 assert.equal(present(s,'r2',week,{code:'a',cook_code:'b'},'2026-10-10').members[1].homeToday,true);
 assert.throws(()=>mutate(s,'r2',{action:'attendance',date:now,away:true,transfers:[]},'2026-10-10'),/day has changed/);
});
test('completed duties need no handover and keep their assignee',()=>{
 const s=tasks();const duty=s.duties.find(d=>d.day===4)!;duty.done=true;
 const wash=laundryEvents(s,now,now).find(t=>t.kind==='wash')!;s.laundryOverrides[wash.id]={done:true};
 const next=away(s,'r2');assert.equal(next.duties.find(d=>d.id===duty.id).assignee,'r2');assert.equal(laundryEvents(next,now,now).find(t=>t.id===wash.id)?.assignee,'r2');
});
test('assigned resident can transfer own unfinished duties but not someone else’s or completed tasks',()=>{
 const s=tasks(),duty=s.duties.find(d=>d.day===4)!;const next=mutate(s,'r2',{action:'duty',id:duty.id,assignee:'r3',utensils:'forged'},now);
 assert.equal(next.duties.find(d=>d.id===duty.id).assignee,'r3');assert.equal(next.duties.find(d=>d.id===duty.id).utensils,duty.utensils);
 assert.throws(()=>mutate(s,'r3',{action:'duty',id:duty.id,assignee:'owner'},now),/assigned resident/);
 duty.done=true;assert.throws(()=>mutate(s,'r2',{action:'duty',id:duty.id,assignee:'owner'},now),/unfinished/);
});
test('laundry transfer is limited to assignee/owner and rejects someone away today',()=>{
 const s=tasks(),turn=laundryEvents(s,now,now)[0];s.members[2].awayDate=now;
 assert.throws(()=>mutate(s,'r3',{action:'laundry',id:turn.id,date:now,assignee:'owner'},now),/assigned resident/);
 assert.throws(()=>mutate(s,'r2',{action:'laundry',id:turn.id,date:now,assignee:'r3'},now),/home today/);
 const next=mutate(s,'r2',{action:'laundry',id:turn.id,date:now,assignee:'owner'},now);assert.equal(laundryEvents(next,now,now)[0].assignee,'owner');
});
test('new plans and same-day rotations assign duties only to residents home today',()=>{
 let s=away(flat(),'r2');s=mutate(s,'owner',{action:'plan',week},now);assert.equal(pendingToday(s,'r2',now).length,0);
 s=mutate(s,'owner',{action:'laundry_schedule',start:now,days:[4],dryOffset:0,washOrder:['r2','owner','r3'],dryOrder:['r2','owner','r3']},now);assert.equal(pendingToday(s,'r2',now).length,0);
});
test('no available resident prevents newly generated duties without corrupting state',()=>{
 let s=flat();for(const uid of ['owner','r2','r3'])s=away(s,uid);const before=structuredClone(s);
 assert.throws(()=>mutate(s,'owner',{action:'plan',week},now),/Nobody is home/);assert.deepEqual(s,before);
});
test('present shows today tasks even while browsing a different week, hides laundry from cook',()=>{
 const s=tasks();assert.equal(present(s,'r2','2026-10-12',{code:'a',cook_code:'b'},now).todayTasks.length,4);
 assert.equal(present(s,'cook',week,{code:'a',cook_code:'b'},now).todayTasks.length,0);
});
test('leaving reassigns today chores away from absent residents',()=>{
 const s=tasks();s.members[0].awayDate=now;const next=leaveFlat(s,'r2',now);assert.equal(pendingToday(next,'owner',now).length,0);assert(pendingToday(next,'r3',now).length>0);
});
