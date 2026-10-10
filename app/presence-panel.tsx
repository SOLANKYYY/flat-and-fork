'use client';
import {useState} from 'react';
import {House,ArrowRightLeft,MapPin,Check,Loader2} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {todayISO} from '@/lib/flat-data';

type Props={data:any;busy:boolean;demo:boolean;error:string;action:(payload:any)=>Promise<boolean>};
export default function PresencePanel({data,busy,demo,error,action}:Props){
 const [open,setOpen]=useState(false),[choices,setChoices]=useState<Record<string,string>>({});
 const me=data.members.find((m:any)=>m.id===data.user.userId);
 const today=data.today||todayISO(),away=me?.awayDate===today;
 const tasks:any[]=data.todayTasks||[];
 const candidates=data.members.filter((m:any)=>m.role==='resident'&&m.id!==me?.id&&m.awayDate!==today);
 const count=tasks.length;
 async function markHome(){await action({action:'attendance',date:today,away:false})}
 return <>
  <section className="presence-panel" aria-label="Today at home">
   <div className="presence-summary"><span className={'presence-icon '+(away?'away':'')}><House size={21}/></span><div><h2>{away?'You’re away today':'You’re home today'}</h2><p>{away?'Your handed-over duties stay with their new assignees.':count?`${count} unfinished ${count===1?'duty':'duties'} today. Hand them over before going away.`:'No unfinished duties assigned to you today.'}</p><small>Today in India · {today}</small></div></div>
   <button className="button ghost" disabled={busy} onClick={()=>{if(demo){void action({action:'attendance'});return;}if(away){void markHome();return;}setChoices({});setOpen(true)}}>{away?<House size={17}/>:<MapPin size={17}/>} {away?'I’m back home':'I’m away today'}</button>
  </section>
  <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value)}}><DialogContent className="flat-dialog"><DialogHeader><DialogTitle>Going away today?</DialogTitle><DialogDescription>Choose a resident who is home for each unfinished duty below. The transfers and your away status are saved together. Your status resets tomorrow.</DialogDescription></DialogHeader>
   <form onSubmit={async e=>{e.preventDefault();if(await action({action:'attendance',date:today,away:true,transfers:tasks.map(task=>({key:task.key,assignee:choices[task.key]}))}))setOpen(false)}}>
    {tasks.length?<div className="handover-list">{tasks.map(task=><label className="field handover-item" key={task.key}><span><ArrowRightLeft size={16}/>{task.label}</span><select required value={choices[task.key]||''} onChange={e=>setChoices({...choices,[task.key]:e.target.value})} disabled={busy}><option value="">Choose someone who is home</option>{candidates.map((m:any)=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>)}</div>:<p className="form-note">You have no unfinished duties today. You can mark yourself away now.</p>}
    {!!tasks.length&&!candidates.length&&<p className="error" role="alert">No other resident is home. Complete your duties, or ask a resident to mark themselves home before transferring.</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    <p className="form-note">This applies to {today} in this flat. Tomorrow’s turns and your other flats are unchanged.</p>
    <button className="button primary wide submit" disabled={busy||(tasks.length>0&&(!candidates.length||tasks.some(t=>!candidates.some((m:any)=>m.id===choices[t.key]))))}>{busy?<Loader2 size={17} className="spinning"/>:<Check size={17}/>} {busy?'Saving…':tasks.length?'Transfer duties & mark away':'Mark away today'}</button>
   </form>
  </DialogContent></Dialog>
 </>;
}
