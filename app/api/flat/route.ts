import {randomBytes,randomUUID} from 'node:crypto';
import {getUser,payload,json,failure} from '@/server/auth';
import {configured,dbFetch,readFlat,listFlats} from '@/server/supabase';
import {AppError,mutate,newFlat,present,text,validWeek,leaveFlat} from '@/server/model';
import {weekOf} from '@/lib/flat-data';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const authConfig=()=>({configured:configured(),google:process.env.GOOGLE_LOGIN_ENABLED==='true',email:process.env.EMAIL_LOGIN_ENABLED==='true'});
async function snapshot(user:any,week:string,id?:string){
 const rows=await listFlats(user.userId);
 const flats=rows.map((r:any)=>({id:r.id,name:r.state.flat.name,number:r.state.flat.number,owner:r.state.flat.owner,role:r.state.members.find((m:any)=>m.id===user.userId)?.role}));
 const selected=id||flats[0]?.id;
 const row=selected?await readFlat(user.userId,selected):null;
 return {user,auth:authConfig(),flats,...(row?present(row.state,user.userId,week,row):{flat:null})};
}
export async function GET(req:Request){try{
 const user=await getUser();if(!user)return json({user:null,flat:null,flats:[],auth:authConfig()});
 const params=new URL(req.url).searchParams;
 return json(await snapshot(user,validWeek(params.get('week')||weekOf()),params.get('flatId')||undefined));
}catch(e){return failure(e)}}
export async function POST(req:Request){try{
 const b=await payload(req);const user=await getUser();if(!user)throw new AppError('Sign in to use your flat.',401);
 const uid=user.userId,week=validWeek(b.week||weekOf());let selected:string;
 if(b.action==='create'){
  selected=randomUUID();await dbFetch('rpc/ff_create',{p_user:uid,p_id:selected,p_code:randomBytes(8).toString('hex').toUpperCase(),p_cook_code:randomBytes(8).toString('hex').toUpperCase(),p_state:newFlat(selected,uid,text(b.flatName,60),text(b.number,20),text(b.name,40))});
 }else if(b.action==='join'){
  selected=await dbFetch('rpc/ff_join',{p_user:uid,p_code:text(b.code,24).toUpperCase(),p_name:text(b.name,40)});
 }else{
  // Every mutation targets an explicit flat; never fall back to another membership.
  selected=text(b.flatId,36);let row=await readFlat(uid,selected);
  let saved=false;
  for(let attempt=0;attempt<3;attempt++){
   if(attempt)row=await readFlat(uid,selected);
   if(b.action==='delete'){
    if(row.state.flat.owner!==uid)throw new AppError('Only the flat owner can delete it.',403);
    if(b.confirmName!==row.state.flat.name)throw new AppError('Type the exact flat name to confirm deletion.');
    saved=await dbFetch('rpc/ff_delete',{p_user:uid,p_id:selected,p_revision:row.revision});
   }else if(b.action==='transfer_owner'){
    if(row.state.flat.owner!==uid)throw new AppError('Only the flat owner can transfer ownership.',403);
    const target=row.state.members.find((m:any)=>m.id===b.target&&m.role==='resident'&&m.id!==uid);
    if(!target)throw new AppError('Choose another resident as the new owner.');
    saved=await dbFetch('rpc/ff_transfer_owner',{p_user:uid,p_id:selected,p_revision:row.revision,p_target:target.id});
   }else{
    const next=b.action==='leave'?leaveFlat(row.state,uid):mutate(row.state,uid,b);
    if(JSON.stringify(next).length>1500000)throw new AppError('This flat has reached its storage limit.',413);
    saved=await dbFetch(b.action==='leave'?'rpc/ff_leave':'rpc/ff_save',{p_user:uid,p_id:selected,p_revision:row.revision,p_state:next});
   }
   if(saved)break;
  }
  if(!saved)throw new AppError('Another flatmate just updated this. Please try again.',409);
  if(b.action==='leave'||b.action==='delete')return json(await snapshot(user,week));
 }
 return json(await snapshot(user,week,selected));
}catch(e){return failure(e)}}
