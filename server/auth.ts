import 'server-only';
import {cookies} from 'next/headers';
import {authFetch,configured} from './supabase';
import {AppError} from './model';
const secure=process.env.NODE_ENV==='production';
export async function setSession(session:any){if(!session.access_token||!session.refresh_token)throw new AppError('Sign-in did not complete. Please try again.',401);const jar=await cookies();const options={httpOnly:true,secure,sameSite:'lax' as const,path:'/'};jar.set('ff_access',session.access_token,{...options,maxAge:Math.max(60,session.expires_in||3600)});jar.set('ff_refresh',session.refresh_token,{...options,maxAge:60*60*24*30});}
export async function clearSession(){const jar=await cookies();jar.delete('ff_access');jar.delete('ff_refresh');}
export async function getUser(){if(!configured())return null;const jar=await cookies();let token=jar.get('ff_access')?.value;let res=token?await authFetch('user',undefined,token):null;
 if((!res||res.status===401||res.status===403)&&jar.get('ff_refresh')?.value){const refresh=await authFetch('token?grant_type=refresh_token',{refresh_token:jar.get('ff_refresh')!.value});if(refresh.ok){const session=await refresh.json();await setSession(session);token=session.access_token;res=await authFetch('user',undefined,token)}else if(refresh.status===400||refresh.status===401){await clearSession();return null}else throw new AppError('Sign-in service is temporarily unavailable. Please retry.',503);}
 if(!res)return null;if(res.status===401||res.status===403)return null;if(!res.ok)throw new AppError('Sign-in service is temporarily unavailable. Please retry.',503);
 const u=await res.json();if(!u.id)return null;return {userId:u.id,displayName:u.user_metadata?.full_name||u.email||'Flatmate',fullName:u.user_metadata?.full_name||null,email:u.email};}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');const url=new URL(req.url);let trusted=false;try{const o=new URL(origin||'');trusted=o.host===(req.headers.get('host')||url.host)&&o.protocol===url.protocol}catch{}if(!trusted)throw new AppError('Please refresh the page and try again.',403)}
export async function payload(req:Request){sameOrigin(req);const raw=await req.text();if(raw.length>16000)throw new AppError('That entry is too long.',413);try{const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw new Error();return b;}catch{throw new AppError('Invalid request.')}}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function failure(e:unknown){if(e instanceof AppError)return json({error:e.message},e.status);console.error('Request failed',e instanceof Error?e.name:'Unknown');return json({error:'Something went wrong. Please try again.'},503)}
