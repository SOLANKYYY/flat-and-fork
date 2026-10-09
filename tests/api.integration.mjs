// Isolated end-to-end API test. Requires a production build and separately installed PGlite.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.argv[2]||'@electric-sql/pglite');
const db=new PGlite();
const owner='00000000-0000-4000-8000-000000000001',resident='00000000-0000-4000-8000-000000000002',outsider='00000000-0000-4000-8000-000000000003';
await db.exec('create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;');
await db.query('insert into auth.users values ($1),($2),($3)',[owner,resident,outsider]);
await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
const mock=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');let value;
  if(url.pathname==='/auth/v1/user'){
   const uid=req.headers.authorization?.replace('Bearer ','');assert([owner,resident,outsider].includes(uid));value={id:uid,email:'test@example.invalid',user_metadata:{full_name:'Test User'}};
  }else{
   assert.equal(req.headers.apikey,'test-secret');const path=url.pathname.slice('/rest/v1/'.length);
   if(path.startsWith('rpc/')){
    let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw);const name=path.slice(4);
    const args=Object.values(b);const q=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args);value=q.rows[0].result;
   }else if(path==='ff_members'){
    const uid=url.searchParams.get('user_id').slice(3),fid=url.searchParams.get('flat_id')?.slice(3);
    value=(await db.query('select flat_id from ff_members where user_id=$1'+(fid?' and flat_id=$2':''),fid?[uid,fid]:[uid])).rows;
   }else if(path==='ff_flats'){
    const ids=url.searchParams.get('id');value=ids.startsWith('in.')?(await db.query('select id,state,created_at from ff_flats where id=ANY($1::uuid[]) order by created_at,id',[ids.slice(4,-1).split(',')])).rows:(await db.query('select * from ff_flats where id=$1',[ids.slice(3)])).rows;
   }else throw Error('Unexpected mock endpoint: '+path);
  }
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({code:e.code,message:e.message}));}
});
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
const mockPort=mock.address().port;
// Ask OS for a free port for the local test application.
const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const appPort=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const base='http://localhost:'+appPort;
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','localhost','--port',String(appPort)],{cwd:new URL('..',import.meta.url),env:{...process.env,SUPABASE_URL:'http://127.0.0.1:'+mockPort,SUPABASE_PUBLISHABLE_KEY:'test-public',SUPABASE_SECRET_KEY:'test-secret',APP_URL:base,GOOGLE_LOGIN_ENABLED:'false',EMAIL_LOGIN_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
let logs='';app.stdout.on('data',b=>{logs+=b;process.stdout.write(b)});app.stderr.on('data',b=>{logs+=b;process.stderr.write(b)});
const call=async(uid,payload,query='')=>{console.log('API',payload?.action||query||'GET');const r=await fetch(base+'/api/flat'+query,{signal:AbortSignal.timeout(15000),method:payload?'POST':'GET',headers:{Cookie:'ff_access='+uid,Origin:base,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});return {status:r.status,body:await r.json()}};
try{
 let ready=false;for(let i=0;i<100;i++){try{await fetch(base+'/api/flat',{signal:AbortSignal.timeout(1000)});ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert(ready,logs);
 let r=await call(owner,{action:'create',name:'Owner',flatName:'First',number:'1'});assert.equal(r.status,200,JSON.stringify(r.body));const first=r.body.flat;
 r=await call(owner,{action:'create',name:'Owner',flatName:'Second',number:'2'});assert.equal(r.status,200,JSON.stringify(r.body));const second=r.body.flat;assert.equal(r.body.flats.length,2);
 r=await call(owner,undefined,'?flatId='+first.id);assert.equal(r.body.flat.id,first.id);assert(!r.body.flats.some(f=>'code' in f));
 r=await call(outsider,undefined,'?flatId='+first.id);assert.equal(r.status,403);
 r=await call(owner,{action:'plan'});assert.equal(r.status,400);
 r=await call(owner,{action:'plan',flatId:second.id});assert.equal(r.status,200);assert.equal(r.body.meals.length,21);
 r=await call(owner,undefined,'?flatId='+first.id);assert.equal(r.body.meals.length,0);
 r=await call(resident,{action:'join',name:'Resident',code:first.code});assert.equal(r.status,200);assert.equal(r.body.flat.id,first.id);
 r=await call(resident,{action:'join',name:'Resident',code:second.code});assert.equal(r.status,200);assert.equal(r.body.flat.id,second.id);
 r=await call(resident,{action:'delete',flatId:first.id,confirmName:'First'});assert.equal(r.status,403);
 r=await call(owner,{action:'leave',flatId:first.id});assert.equal(r.status,400);
 r=await call(owner,{action:'transfer_owner',flatId:first.id,target:resident});assert.equal(r.status,200);
 r=await call(owner,{action:'leave',flatId:first.id});assert.equal(r.status,200);assert.equal(r.body.flat.id,second.id);assert.equal(r.body.flats.length,1);
 r=await call(owner,undefined,'?flatId='+first.id);assert.equal(r.status,403);
 r=await call(owner,{action:'delete',flatId:second.id,confirmName:'wrong'});assert.equal(r.status,400);
 r=await call(owner,{action:'delete',flatId:second.id,confirmName:'Second'});assert.equal(r.status,200);assert.equal(r.body.flat,null);assert.equal(r.body.flats.length,0);
 r=await call(resident);assert.equal(r.body.flats.length,1);assert.equal(r.body.flat.id,first.id);
 console.log('PASS: authenticated API create, join, switch, scoped mutations, foreign access rejection, ownership transfer, leave, typed deletion and remaining-flat selection.');
}finally{app.kill();mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));await db.close();}
