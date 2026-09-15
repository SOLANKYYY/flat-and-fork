import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {authFetch} from '@/server/supabase';
import {setSession} from '@/server/auth';
export const dynamic='force-dynamic';
export async function GET(req:Request){const origin=process.env.APP_URL||new URL(req.url).origin;try{const code=new URL(req.url).searchParams.get('code');const jar=await cookies();const verifier=jar.get('ff_pkce')?.value;jar.delete('ff_pkce');if(!code||!verifier)throw new Error();const res=await authFetch('token?grant_type=pkce',{auth_code:code,code_verifier:verifier});if(!res.ok)throw new Error();await setSession(await res.json());return NextResponse.redirect(origin+'/');}catch{return NextResponse.redirect(origin+'/?login_error=expired')}}
