// Run against an isolated embedded PostgreSQL instance, never a live project.
// Pass a PGlite module path as argv[2], or install @electric-sql/pglite locally.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newFlat,makeMember,leaveFlat} from '../server/model.ts';
const {PGlite}=await import(process.argv[2]||'@electric-sql/pglite');
const db=new PGlite();
const sql=async(q,args=[])=>db.query(q,args);
const u='00000000-0000-4000-8000-000000000001',v='00000000-0000-4000-8000-000000000002',x='00000000-0000-4000-8000-000000000003';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
await db.exec('create schema auth; create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;');
await sql('insert into auth.users values ($1),($2),($3)',[u,v,x]);
if(process.argv[3]){
 await db.exec(await readFile(process.argv[3],'utf8'));
 await sql('select ff_create($1,$2,$3,$4,$5)',[u,a,'A','AC',newFlat(a,u,'First','1','Owner')]);
 const migration=await readFile(new URL('../supabase/migrations/20261009_multiple_flats.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 assert.equal((await sql('select count(*)::int as n from ff_members')).rows[0].n,1);
}else{
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 await sql('select ff_create($1,$2,$3,$4,$5)',[u,a,'A','AC',newFlat(a,u,'First','1','Owner')]);
}
await sql('select ff_create($1,$2,$3,$4,$5)',[u,b,'B','BC',newFlat(b,u,'Second','2','Owner')]);
assert.equal((await sql('select count(*)::int as n from ff_members where user_id=$1',[u])).rows[0].n,2);
for(const code of ['A','B'])await sql('select ff_join($1,$2,$3)',[v,code,'Resident']);
await assert.rejects(sql('select ff_join($1,$2,$3)',[v,'A','Duplicate']),e=>e.code==='23505');
await assert.rejects(sql('select ff_delete($1,$2,$3)',[v,a,1]),/access denied/);
await assert.rejects(sql('select ff_transfer_owner($1,$2,$3,$4)',[u,a,1,x]),/another resident/);
assert.equal((await sql('select ff_transfer_owner($1,$2,$3,$4) as ok',[u,a,0,v])).rows[0].ok,false);
assert.equal((await sql('select ff_transfer_owner($1,$2,$3,$4) as ok',[u,a,1,v])).rows[0].ok,true);
const row=(await sql('select * from ff_flats where id=$1',[a])).rows[0];
const next=leaveFlat(row.state,u);
assert.equal((await sql('select ff_leave($1,$2,$3,$4) as ok',[u,a,row.revision,next])).rows[0].ok,true);
assert.equal((await sql('select count(*)::int as n from ff_members where user_id=$1',[u])).rows[0].n,1);
await assert.rejects(sql('select ff_save($1,$2,$3,$4)',[u,a,3,next]),/access denied/);
await assert.rejects(sql('select ff_leave($1,$2,$3,$4)',[v,a,3,{...next,members:[]}]),/Owner must transfer/);
assert.equal((await sql('select ff_delete($1,$2,$3) as ok',[v,a,2])).rows[0].ok,false);
assert.equal((await sql('select ff_delete($1,$2,$3) as ok',[v,a,3])).rows[0].ok,true);
assert.equal((await sql('select count(*)::int as n from ff_members where flat_id=$1',[a])).rows[0].n,0);
assert.equal((await sql('select count(*)::int as n from ff_members where flat_id=$1',[b])).rows[0].n,2);
await db.exec('set role authenticated');
await assert.rejects(sql('select * from public.ff_flats'),/permission denied/);
await assert.rejects(sql('select public.ff_delete($1,$2,$3)',[u,b,1]),/permission denied/);
await db.exec('reset role');
await db.close();
console.log('PASS: schema/migration, preserved data, multiple memberships, duplicate joins, owner transfer, scoped leave/delete, revision checks and browser-role permissions.');
