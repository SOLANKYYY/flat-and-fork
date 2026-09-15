-- Run once in a new Supabase project's SQL Editor.
-- Only the Next.js server can read/write these tables. Client database access is denied.
begin;
create table if not exists public.ff_flats (
 id uuid primary key,
 code text not null unique,
 cook_code text not null unique,
 revision bigint not null default 0,
 state jsonb not null,
 created_at timestamptz not null default now()
);
create table if not exists public.ff_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 flat_id uuid not null references public.ff_flats(id) on delete cascade
);
create index if not exists ff_members_flat_idx on public.ff_members(flat_id);
alter table public.ff_flats enable row level security;
alter table public.ff_members enable row level security;
revoke all on public.ff_flats, public.ff_members from anon, authenticated;
grant all on public.ff_flats, public.ff_members to service_role;

create or replace function public.ff_create(p_user uuid,p_id uuid,p_code text,p_cook_code text,p_state jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_state#>>'{flat,owner}' <> p_user::text or p_state#>>'{flat,id}' <> p_id::text then raise exception 'Invalid flat'; end if;
 insert into public.ff_flats(id,code,cook_code,state) values(p_id,p_code,p_cook_code,p_state);
 insert into public.ff_members(user_id,flat_id) values(p_user,p_id);
end;
$$;
create or replace function public.ff_join(p_user uuid,p_code text,p_name text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.ff_flats%rowtype; member jsonb; member_role text;
begin
 if length(trim(p_name))=0 or length(p_name)>40 then raise exception 'Enter your name'; end if;
 select * into f from public.ff_flats where code=p_code or cook_code=p_code for update;
 if not found then raise exception 'Join code not found'; end if;
 if jsonb_array_length(f.state->'members') >= 40 then raise exception 'This flat has reached 40 members'; end if;
 member_role := case when f.cook_code=p_code then 'cook' else 'resident' end;
 member := jsonb_build_object('id',p_user::text,'name',trim(p_name),'role',member_role,'diet','Vegetarian','likes','','avoid','','allergies','');
 insert into public.ff_members(user_id,flat_id) values(p_user,f.id);
 update public.ff_flats set state=jsonb_set(state,'{members}',(state->'members')||jsonb_build_array(member)),revision=revision+1 where id=f.id;
end;
$$;
create or replace function public.ff_save(p_user uuid,p_id uuid,p_revision bigint,p_state jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
 if not exists(select 1 from public.ff_members where user_id=p_user and flat_id=p_id) then raise exception 'Flat access denied'; end if;
 -- Keep identity and membership changes confined to create/join.
 update public.ff_flats set state=p_state,revision=revision+1
 where id=p_id and revision=p_revision
 and state->'flat'=p_state->'flat'
 and (select jsonb_agg(m->'id' order by m->>'id') from jsonb_array_elements(state->'members') m)
     = (select jsonb_agg(m->'id' order by m->>'id') from jsonb_array_elements(p_state->'members') m);
 get diagnostics changed=row_count;
 return changed=1;
end;
$$;
revoke all on function public.ff_create(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.ff_join(uuid,text,text) from public,anon,authenticated;
revoke all on function public.ff_save(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.ff_create(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.ff_join(uuid,text,text) to service_role;
grant execute on function public.ff_save(uuid,uuid,bigint,jsonb) to service_role;
commit;
