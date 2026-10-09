import {MENU,weekOf,dateAt,todayISO} from '../lib/flat-data.ts';
export type Role='resident'|'cook';
export type Member={id:string;name:string;role:Role;diet:string;likes:string;avoid:string;allergies:string};
export type FlatState={flat:{id:string;name:string;number:string;owner:string};members:Member[];formerMembers?:Member[];meals:any[];requests:any[];duties:any[];supplies:any[];laundrySchedules:any[];laundryOverrides:Record<string,any>};
export class AppError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status}}
export function text(v:unknown,max=120,empty=false):string{if(empty&&(v===undefined||v===''))return '';if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new AppError('Please check the required fields.');return v.trim()}
export function validDate(v:unknown){const s=text(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)throw new AppError('Choose a valid date.');return s}
export function validWeek(v:unknown){const s=validDate(v);if(weekOf(s)!==s)throw new AppError('Choose a week starting on Monday.');return s}
export function makeMember(id:string,name:string,role:Role):Member{return {id,name:text(name,40),role,diet:'Vegetarian',likes:'',avoid:'',allergies:''}}
export function newFlat(id:string,uid:string,name:string,number:string,memberName:string):FlatState{return {flat:{id,name:text(name,60),number:text(number,20),owner:uid},members:[makeMember(uid,memberName,'resident')],meals:[],requests:[],duties:[],supplies:[],laundrySchedules:[],laundryOverrides:{}}}
function position(b:any){if(!Number.isInteger(b.day)||b.day<0||b.day>6||!Number.isInteger(b.slot)||b.slot<0||b.slot>2)throw new AppError('Choose a day and a meal.')}
function bool(v:any){if(typeof v!=='boolean')throw new AppError('Invalid status.');return v}
export function laundryEvents(s:FlatState,from:string,to:string){
 const rows:any[]=[];
 for(const c of s.laundrySchedules||[]){
  const days:number[]=c.days;const anchor=weekOf(c.start);const start=from>c.start?dateAt(from,-c.dryOffset):c.start;
  for(let date=start;date<=to;date=dateAt(date,1)){
   if(date<c.start||(c.end&&date>c.end))continue;
   const day=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;const pos=days.indexOf(day);if(pos<0)continue;
   const weeks=Math.round((Date.parse(weekOf(date))-Date.parse(anchor))/604800000);
   const ordinal=weeks*days.length+pos-days.filter(d=>dateAt(anchor,d)<c.start).length;
   for(const kind of ['wash','dry']){
    const actual=kind==='wash'?date:dateAt(date,c.dryOffset);if(actual<from||actual>to)continue;
    const order=kind==='wash'?c.washOrder:c.dryOrder;const id=c.id+':'+date+':'+kind;
    const base={id,date:actual,washDate:date,kind,assignee:order[((ordinal%order.length)+order.length)%order.length],done:false,note:''};
    rows.push({...base,...s.laundryOverrides?.[id]});
   }
  }
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind));
}
function validOrder(v:any,residents:Member[]){if(!Array.isArray(v)||v.length!==residents.length||new Set(v).size!==v.length||v.some(id=>!residents.some(m=>m.id===id)))throw new AppError('Include every resident once in the rotation.');return v}
export function mutate(original:FlatState,uid:string,b:any,now=todayISO()):FlatState{
 const s=structuredClone(original);const me=s.members.find(m=>m.id===uid);if(!me)throw new AppError('You do not belong to this flat.',403);
 const owner=s.flat.owner===uid,resident=me.role==='resident',kitchen=owner||me.role==='cook';const residents=s.members.filter(m=>m.role==='resident');const week=validWeek(b.week||weekOf(now));
 const requireOwner=()=>{if(!owner)throw new AppError('Only the flat creator can change this.',403)};
 const requireResident=()=>{if(!resident)throw new AppError('This action is for residents.',403)};
 const find=(rows:any[])=>{const x=rows.find(x=>x.id===b.id);if(!x)throw new AppError('This item could not be found.',404);return x};
 switch(b.action){
 case 'profile':{
  me.name=text(b.name,40);if(!['Vegetarian','Vegan','Eggetarian','Non-vegetarian','No preference'].includes(b.diet))throw new AppError('Choose a food preference.');me.diet=b.diet;me.likes=text(b.likes,300,true);me.avoid=text(b.avoid,300,true);me.allergies=text(b.allergies,300,true);break;
 }
 case 'plan':{
  if(!kitchen)throw new AppError('The cook or flat creator can start a weekly plan.',403);
  const rotation=Math.floor(Date.parse(week)/604800000)%residents.length;
  MENU.forEach((row,day)=>row.forEach((title,slot)=>{if(!s.meals.some(m=>m.week===week&&m.day===day&&m.slot===slot))s.meals.push({id:crypto.randomUUID(),week,day,slot,title,prepared:false});}));
  for(let day=0;day<7;day++)for(let slot=1;slot<3;slot++)if(!s.duties.some(d=>d.week===week&&d.day===day&&d.slot===slot))s.duties.push({id:crypto.randomUUID(),week,day,slot,assignee:residents[(rotation+day*2+slot-1)%residents.length].id,done:false,utensils:'Plates, bowls, kadai & countertop'});
  break;
 }
 case 'prepared':{if(!kitchen)throw new AppError('The cook or flat creator marks meals prepared.',403);const m=find(s.meals);m.prepared=bool(b.prepared);m.preparedBy=uid;break;}
 case 'request':{
  position(b);if(!s.meals.some(m=>m.week===week&&m.day===b.day&&m.slot===b.slot))throw new AppError('Start this week’s menu before suggesting a change.');
  s.requests.unshift({id:crypto.randomUUID(),week,day:b.day,slot:b.slot,title:text(b.title),reason:text(b.reason,300,true),author:uid,status:'open',supporters:resident?[uid]:[],created:new Date().toISOString()});break;
 }
 case 'vote':{requireResident();const r=find(s.requests);if(r.status!=='open')throw new AppError('This request is closed.');r.supporters=r.supporters.filter((id:string)=>id!==uid);if(bool(b.support))r.supporters.push(uid);break;}
 case 'apply':{
  if(!kitchen)throw new AppError('The cook or flat creator applies approved changes.',403);const r=find(s.requests);if(r.status!=='open')throw new AppError('This request is closed.');
  if(r.supporters.filter((id:string)=>residents.some(m=>m.id===id)).length<=residents.length/2)throw new AppError('More than half the residents must support this change.');
  const m=s.meals.find(m=>m.week===r.week&&m.day===r.day&&m.slot===r.slot);if(!m)throw new AppError('Meal not found.');m.title=r.title;m.prepared=false;r.status='applied';break;
 }
 case 'duty':{
  requireResident();const x=find(s.duties);
  if(b.assignee!==undefined){requireOwner();if(!residents.some(m=>m.id===b.assignee))throw new AppError('Choose a resident.');x.assignee=b.assignee;x.utensils=text(b.utensils,240);}
  else{if(!owner&&x.assignee!==uid)throw new AppError('Only the assigned resident or flat creator can mark this duty.',403);x.done=bool(b.done)}break;
 }
 case 'supply':{if(b.id)find(s.supplies).done=bool(b.done);else s.supplies.push({id:crypto.randomUUID(),title:text(b.title),done:false});break;}
 case 'laundry_schedule':{
  requireOwner();const start=validDate(b.start);if(start<now||start>dateAt(now,90))throw new AppError('Start the rotation today or within the next 90 days.');
  if(!Array.isArray(b.days)||b.days.length===0||b.days.length>7||new Set(b.days).size!==b.days.length||b.days.some((x:any)=>!Number.isInteger(x)||x<0||x>6))throw new AppError('Choose at least one washing day.');
  if(![0,1,2].includes(b.dryOffset))throw new AppError('Choose when drying happens.');
  const last=s.laundrySchedules.at(-1);if(last&&start<=last.start)throw new AppError('Start the new rotation after the previous rotation’s start date. You can manually edit individual turns.');
  if(last){const preserved=laundryEvents(s,start,dateAt(start,90)).some(x=>x.done);if(preserved)throw new AppError('There are completed turns on or after this date. Choose a later start date to preserve them.');last.end=dateAt(start,-1);}
  s.laundrySchedules.push({id:crypto.randomUUID(),start,end:null,days:[...b.days].sort((a:number,z:number)=>a-z),dryOffset:b.dryOffset,washOrder:validOrder(b.washOrder,residents),dryOrder:validOrder(b.dryOrder,residents)});break;
 }
 case 'laundry':{
  requireResident();const date=validDate(b.date);const x=laundryEvents(s,date,date).find(x=>x.id===b.id);if(!x)throw new AppError('This laundry turn no longer exists. Refresh the schedule.');
  const o={...(s.laundryOverrides[x.id]||{})};
  if(b.assignee!==undefined){if(!residents.some(m=>m.id===b.assignee))throw new AppError('Choose a resident.');o.assignee=b.assignee;o.note=text(b.note,240,true);o.editedBy=uid;}
  else{if(!owner&&x.assignee!==uid)throw new AppError('Only the assigned resident or flat creator can complete this turn.',403);o.done=bool(b.done);o.completedBy=o.done?uid:null;}
  s.laundryOverrides[x.id]=o;break;
 }
 default:throw new AppError('Unknown action.');
 }
 return s;
}
export function present(s:FlatState,uid:string,week:string,codes:{code:string;cook_code:string},now=todayISO()){
 const me=s.members.find(m=>m.id===uid);if(!me)throw new AppError('You do not belong to this flat.',403);const resident=me.role==='resident';
 const residents=s.members.filter(m=>m.role==='resident');
 const laundry=resident?laundryEvents(s,week,dateAt(week,6)):[];
 const upcoming=resident?laundryEvents(s,now,dateAt(now,90)).filter(x=>!x.done):[];
 return {flat:{...s.flat,code:resident?codes.code:undefined,cookCode:s.flat.owner===uid?codes.cook_code:undefined},members:s.members,formerMembers:s.formerMembers||[],meals:s.meals.filter(m=>m.week===week),requests:s.requests.filter(r=>r.week===week).map(r=>{const {supporters,...rest}=r;return {...rest,name:s.members.find(m=>m.id===r.author)?.name,votes:supporters.filter((id:string)=>residents.some(m=>m.id===id)).length,mine:supporters.includes(uid)}}),duties:resident?s.duties.filter(d=>d.week===week):[],supplies:s.supplies,laundry,laundryNext:{wash:upcoming.filter(x=>x.kind==='wash').slice(0,2),dry:upcoming.filter(x=>x.kind==='dry').slice(0,2)},laundryConfig:resident?s.laundrySchedules.at(-1)||null:null};
}


// Leaving removes access, keeps historical names and completions, and updates future chores.
export function leaveFlat(original:FlatState,uid:string,now=todayISO()):FlatState{
 const s=structuredClone(original);const member=s.members.find(m=>m.id===uid);
 if(!member)throw new AppError('You do not belong to this flat.',403);
 if(s.flat.owner===uid)throw new AppError('Transfer ownership to another resident before leaving. If you are the only resident, delete the flat instead.');
 s.members=s.members.filter(m=>m.id!==uid);
 s.formerMembers=[...(s.formerMembers||[]).filter(m=>m.id!==uid),member];
 const residents=s.members.filter(m=>m.role==='resident');
 s.requests=s.requests.map(r=>({...r,supporters:r.supporters.filter((id:string)=>id!==uid)}));
 let turn=0;
 s.duties=s.duties.map(d=>d.assignee===uid&&!d.done&&dateAt(d.week,d.day)>=now?{...d,assignee:residents[turn++%residents.length].id}:d);
 // Cooks have no laundry assignments. Retain schedule IDs until a resident leaves.
 if(member.role==='cook')return s;
 const previous=structuredClone(s);
 const rebuilt:any[]=[];
 for(const schedule of s.laundrySchedules){
  if(schedule.end&&schedule.end<now){rebuilt.push(schedule);continue;}
  const next={...schedule,id:crypto.randomUUID(),start:schedule.start>now?schedule.start:now,washOrder:schedule.washOrder.filter((id:string)=>id!==uid),dryOrder:schedule.dryOrder.filter((id:string)=>id!==uid)};
  if(!next.washOrder.length)next.washOrder=residents.map(m=>m.id);
  if(!next.dryOrder.length)next.dryOrder=residents.map(m=>m.id);
  if(schedule.start<now)rebuilt.push({...schedule,end:dateAt(now,-1)});
  rebuilt.push(next);
  // Copy explicit overrides, including completed future turns, onto replacement IDs.
  for(const [id,override] of Object.entries(previous.laundryOverrides||{})){
   const prefix=schedule.id+':';if(!id.startsWith(prefix))continue;
   const [washDate,kind]=id.slice(prefix.length).split(':');if(washDate<next.start)continue;
   const preserved={...override};if(preserved.assignee===uid&&!preserved.done)preserved.assignee=residents[0].id;
   if(preserved.done&&!preserved.assignee){const date=kind==='dry'?dateAt(washDate,schedule.dryOffset):washDate;preserved.assignee=laundryEvents(previous,date,date).find(x=>x.id===id)?.assignee;}
   s.laundryOverrides[next.id+':'+washDate+':'+kind]=preserved;
  }
 }
 s.laundrySchedules=rebuilt;
 // Drying from a wash before today remains on the old schedule; reassign only pending turns.
 for(const event of laundryEvents(s,now,dateAt(now,2))){if(event.assignee===uid&&!event.done)s.laundryOverrides[event.id]={...(s.laundryOverrides[event.id]||{}),assignee:residents[0].id};}
 return s;
}
