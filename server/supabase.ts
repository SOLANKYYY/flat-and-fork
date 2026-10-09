import 'server-only';
import {AppError} from './model';
export function config(){const url=process.env.SUPABASE_URL?.replace(/\/$/,'');const key=process.env.SUPABASE_PUBLISHABLE_KEY;const secret=process.env.SUPABASE_SECRET_KEY;if(!url||!key||!secret)throw new AppError('Account setup is not finished. The site owner needs to configure Supabase.',503);return {url,key,secret};}
export function configured(){return !!(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY&&process.env.SUPABASE_SECRET_KEY)}
export async function authFetch(path:string,body?:unknown,token?:string){const {url,key}=config();return fetch(url+'/auth/v1/'+path,{method:body!==undefined?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(12000)});}
export async function dbFetch(path:string,body?:unknown){const {url,secret}=config();const res=await fetch(url+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:secret,...(secret.startsWith('sb_')?{}:{Authorization:'Bearer '+secret}),'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(12000)});if(!res.ok){const e=await res.json().catch(()=>({}));console.error('Database request failed',res.status,e.code);if(e.code==='23505')throw new AppError('You already belong to this flat. Select it from My flats.');if(e.message==='Join code not found')throw new AppError('That join code was not found. Check it with your flatmate.');if(e.message==='This flat has reached 40 members')throw new AppError(e.message);throw new AppError('Your flat could not be saved. Please try again.',503)}const bodyText=await res.text();return bodyText?JSON.parse(bodyText):null;}
export async function listFlats(uid:string){
 const members=await dbFetch('ff_members?user_id=eq.'+encodeURIComponent(uid)+'&select=flat_id');
 if(!members.length)return [];
 return dbFetch('ff_flats?id=in.('+members.map((m:any)=>encodeURIComponent(m.flat_id)).join(',')+')&select=id,state,created_at&order=created_at.asc,id.asc');
}
export async function readFlat(uid:string,id:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new AppError('Invalid flat.',400);
 const members=await dbFetch('ff_members?user_id=eq.'+encodeURIComponent(uid)+'&flat_id=eq.'+id+'&select=flat_id');
 if(!members.length)throw new AppError('You no longer belong to this flat. Select another flat.',403);
 const flats=await dbFetch('ff_flats?id=eq.'+id+'&select=*');
 if(!flats.length)throw new AppError('This flat is no longer available.',404);
 return flats[0];
}

