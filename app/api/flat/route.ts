import {randomBytes,randomUUID} from 'node:crypto';
import {getUser,payload,json,failure} from '@/server/auth';
import {configured,dbFetch,readFlat} from '@/server/supabase';
import {AppError,mutate,newFlat,present,text,validWeek} from '@/server/model';
import {weekOf} from '@/lib/flat-data';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const authConfig=()=>({configured:configured(),google:process.env.GOOGLE_LOGIN_ENABLED==='true',email:process.env.EMAIL_LOGIN_ENABLED==='true'});
export async function GET(req:Request){try{const user=await getUser();if(!user)return json({user:null,flat:null,auth:authConfig()});const week=validWeek(new URL(req.url).searchParams.get('week')||weekOf());const row=await readFlat(user.userId);return json({user,auth:authConfig(),...(row?present(row.state,user.userId,week,row):{flat:null})});}catch(e){return failure(e)}}
export async function POST(req:Request){try{const b=await payload(req);const user=await getUser();if(!user)throw new AppError('Sign in to use your flat.',401);const uid=user.userId,week=validWeek(b.week||weekOf());let row=await readFlat(uid);
 if(b.action==='create'||b.action==='join'){
  if(row)throw new AppError('You already belong to a flat.');const name=text(b.name,40);
  if(b.action==='create'){const id=randomUUID();await dbFetch('rpc/ff_create',{p_user:uid,p_id:id,p_code:randomBytes(8).toString('hex').toUpperCase(),p_cook_code:randomBytes(8).toString('hex').toUpperCase(),p_state:newFlat(id,uid,text(b.flatName,60),text(b.number,20),name)});}
  else await dbFetch('rpc/ff_join',{p_user:uid,p_code:text(b.code,24).toUpperCase(),p_name:name});
 }else{
  if(!row)throw new AppError('Create or join a flat first.',403);
  let saved=false;
  // Compare-and-swap prevents one flatmate's update from erasing another's.
  for(let attempt=0;attempt<3;attempt++){
   if(attempt){row=await readFlat(uid);if(!row)throw new AppError('Flat access changed.',403)}
   const next=mutate(row.state,uid,b);
   if(JSON.stringify(next).length>1500000)throw new AppError('This flat has reached its storage limit. Contact the site owner.',413);
   saved=await dbFetch('rpc/ff_save',{p_user:uid,p_id:row.id,p_revision:row.revision,p_state:next});if(saved)break;
  }
  if(!saved)throw new AppError('Another flatmate just updated this. Please try again.',409);
 }
 row=await readFlat(uid);if(!row)throw new AppError('Your flat could not be loaded. Refresh the page.',503);return json({user,auth:authConfig(),...present(row.state,uid,week,row)});
 }catch(e){return failure(e)}}
