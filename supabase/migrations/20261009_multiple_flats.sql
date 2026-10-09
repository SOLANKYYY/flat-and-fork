-- Existing projects: run this transaction once. Existing flats/members are preserved.
-- Authentication, API keys and provider configuration are not changed.
begin;
lock table public.ff_members in access exclusive mode;
alter table public.ff_members drop constraint if exists ff_members_pkey;
alter table public.ff_members add primary key (user_id,flat_id);

-- The return value identifies the newly joined flat for the selector.
drop function if exists public.ff_join(uuid,text,text);
create function public.ff_join(p_user uuid,p_code text,p_name text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.ff_flats%rowtype; member jsonb; member_role text;
begin
 if p_name is null or length(trim(p_name))=0 or length(p_name)>40 then raise exception 'Enter your name'; end if;
 select * into f from public.ff_flats where code=p_code or cook_code=p_code for update;
 if not found then raise exception 'Join code not found'; end if;
 if exists(select 1 from public.ff_members where user_id=p_user and flat_id=f.id) then raise exception unique_violation using message='Already a member'; end if;
 if jsonb_array_length(f.state->'members') >= 40 then raise exception 'This flat has reached 40 members'; end if;
 member_role := case when f.cook_code=p_code then 'cook' else 'resident' end;
 member := jsonb_build_object('id',p_user::text,'name',trim(p_name),'role',member_role,'diet','Vegetarian','likes','','avoid','','allergies','');
 insert into public.ff_members(user_id,flat_id) values(p_user,f.id);
 update public.ff_flats set state=jsonb_set(state,'{members}',(state->'members')||jsonb_build_array(member)),revision=revision+1 where id=f.id;
 return f.id;
end;
$$;

create or replace function public.ff_leave(p_user uuid,p_id uuid,p_revision bigint,p_state jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.ff_flats%rowtype;
begin
 select * into f from public.ff_flats where id=p_id for update;
 if not found then return false; end if;
 if not exists(select 1 from public.ff_members where user_id=p_user and flat_id=p_id) then raise exception 'Flat access denied'; end if;
 if f.state#>>'{flat,owner}'=p_user::text then raise exception 'Owner must transfer ownership before leaving'; end if;
 if f.revision<>p_revision then return false; end if;
 if f.state->'flat' is distinct from p_state->'flat' or
 (select jsonb_agg(m->'id' order by m->>'id') from jsonb_array_elements(f.state->'members') m where m->>'id'<>p_user::text)
 is distinct from
 (select jsonb_agg(m->'id' order by m->>'id') from jsonb_array_elements(p_state->'members') m)
 then raise exception 'Invalid membership update'; end if;
 update public.ff_flats set state=p_state,revision=revision+1 where id=p_id;
 delete from public.ff_members where user_id=p_user and flat_id=p_id;
 return true;
end;
$$;

create or replace function public.ff_transfer_owner(p_user uuid,p_id uuid,p_revision bigint,p_target uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.ff_flats%rowtype;
begin
 select * into f from public.ff_flats where id=p_id for update;
 if not found then return false; end if;
 if f.state#>>'{flat,owner}' is distinct from p_user::text or
 not exists(select 1 from public.ff_members where user_id=p_user and flat_id=p_id) then raise exception 'Flat access denied'; end if;
 if f.revision<>p_revision then return false; end if;
 if p_target=p_user or not exists(select 1 from public.ff_members where user_id=p_target and flat_id=p_id) or
 not exists(select 1 from jsonb_array_elements(f.state->'members') m where m->>'id'=p_target::text and m->>'role'='resident') then raise exception 'Choose another resident'; end if;
 update public.ff_flats set state=jsonb_set(state,'{flat,owner}',to_jsonb(p_target::text)),revision=revision+1 where id=p_id;
 return true;
end;
$$;

create or replace function public.ff_delete(p_user uuid,p_id uuid,p_revision bigint)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.ff_flats%rowtype;
begin
 select * into f from public.ff_flats where id=p_id for update;
 if not found then return false; end if;
 if f.state#>>'{flat,owner}' is distinct from p_user::text or
 not exists(select 1 from public.ff_members where user_id=p_user and flat_id=p_id) then raise exception 'Flat access denied'; end if;
 if f.revision<>p_revision then return false; end if;
 delete from public.ff_flats where id=p_id;
 -- Existing foreign-key cascade removes only this flat's membership rows.
 return true;
end;
$$;
revoke all on function public.ff_join(uuid,text,text) from public,anon,authenticated;
revoke all on function public.ff_leave(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.ff_transfer_owner(uuid,uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function public.ff_delete(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.ff_join(uuid,text,text) to service_role;
grant execute on function public.ff_leave(uuid,uuid,bigint,jsonb) to service_role;
grant execute on function public.ff_transfer_owner(uuid,uuid,bigint,uuid) to service_role;
grant execute on function public.ff_delete(uuid,uuid,bigint) to service_role;
commit;
