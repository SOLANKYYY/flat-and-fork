import {randomBytes,createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {config} from '@/server/supabase';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 if(process.env.GOOGLE_LOGIN_ENABLED!=='true')return NextResponse.redirect(new URL('/?login_error=google_disabled',req.url));
 const {url}=config();const origin=process.env.APP_URL||new URL(req.url).origin;const verifier=randomBytes(48).toString('base64url');
 (await cookies()).set('ff_pkce',verifier,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
 const u=new URL(url+'/auth/v1/authorize');u.searchParams.set('provider','google');u.searchParams.set('redirect_to',origin+'/auth/callback');u.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));u.searchParams.set('code_challenge_method','s256');
 return NextResponse.redirect(u);
 }catch{return NextResponse.redirect(new URL('/?login_error=setup',req.url))}}
