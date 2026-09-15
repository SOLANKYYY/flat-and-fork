import {cookies} from 'next/headers';
import {payload,json,failure,setSession,clearSession} from '@/server/auth';
import {authFetch} from '@/server/supabase';
import {AppError,text} from '@/server/model';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{const b=await payload(req);
 if(b.action==='logout'){const token=(await cookies()).get('ff_access')?.value;if(token){try{await authFetch('logout?scope=local',{},token)}catch{}}await clearSession();return json({ok:true});}
 if(process.env.EMAIL_LOGIN_ENABLED!=='true')throw new AppError('Email sign-in is not enabled. Use Google to continue.');
 const email=text(b.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AppError('Enter a valid email address.');
 let res:Response;
 if(b.action==='send')res=await authFetch('otp',{email,create_user:true});
 else if(b.action==='verify'){const token=text(b.token,10);if(!/^\d{6,10}$/.test(token))throw new AppError('Enter the code from your email.');res=await authFetch('verify',{email,token,type:'email'});}
 else throw new AppError('Unknown sign-in action.');
 if(!res.ok){if(res.status===429)throw new AppError('Please wait a minute before requesting another code.',429);if(b.action==='verify')throw new AppError('That code is invalid or expired. Request a new one.');throw new AppError('The email could not be sent. Try again, or ask the flat owner to check email delivery.',503);}
 if(b.action==='verify')await setSession(await res.json());return json({ok:true});
 }catch(e){return failure(e)}}
