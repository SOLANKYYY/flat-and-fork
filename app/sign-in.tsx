'use client';
import {useState} from 'react';
import {House,ArrowRight,Loader2} from 'lucide-react';
export default function SignIn({auth,onSuccess}:{auth:any;onSuccess:()=>void}){
 const [email,setEmail]=useState(''),[token,setToken]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function send(action:string){setBusy(true);setError('');try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,token})});const d=await r.json();if(!r.ok)throw new Error(d.error);if(action==='send')setSent(true);else onSuccess();}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="signin-box"><div className="signin-symbol"><House size={28}/></div><h3>One account. Your own flat.</h3><p>Sign in to create or join your flat and keep everyone’s changes in sync.</p>
 {!auth?.configured?<div className="form-note">Account setup isn’t finished yet. You can explore the sample flat while the owner connects the accounts service.</div>:<>
 {auth.google&&<a className="button primary wide" href="/auth/google">Continue with Google <ArrowRight size={17}/></a>}
 {auth.email&&<form onSubmit={e=>{e.preventDefault();send(sent?'verify':'send')}} className="email-login"><label className="field">Email address<input type="email" autoComplete="email" required maxLength={254} disabled={sent||busy} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>{sent&&<><p className="form-note">Check your inbox for your sign-in code.</p><label className="field">Email code<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,10}" maxLength={10} value={token} onChange={e=>setToken(e.target.value)} placeholder="Enter your code"/></label></>}<button className="button ghost wide submit" disabled={busy}>{busy?<Loader2 size={17} className="spinning"/>:<ArrowRight size={17}/>} {sent?'Verify & sign in':'Email me a sign-in code'}</button>{sent&&<button type="button" className="text-button resend" disabled={busy} onClick={()=>{setSent(false);setToken('');setError('')}}>Change email or resend code</button>}</form>}
 {!auth.google&&!auth.email&&<div className="form-note">The owner still needs to enable Google or email sign-in.</div>}
 </>}{error&&<div className="error" role="alert">{error}</div>}</div>
}
