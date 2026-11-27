begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Browser roles must never be able to create objects used by these policies.
revoke create on schema public from public, anon, authenticated;
create table public.admin_accounts (
 user_id uuid primary key references auth.users(id) on delete restrict,
 role text not null check(role in ('owner','administrator','editor','servant')),
 active boolean not null default true
);
create table public.ministries (
 id uuid primary key default gen_random_uuid(), name text not null,
 slug text unique not null
);
create table public.admin_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.admin_accounts(user_id) on delete cascade,
 permission text not null check(permission in ('announcements.edit','announcements.publish','events.edit','events.publish','schedules.manage','audit.read')),
 ministry_id uuid references public.ministries(id),
 unique nulls not distinct (user_id,permission,ministry_id)
);
create function private.allowed(permission_name text, scope_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(permission_name = any(array[
 'announcements.edit','announcements.publish','events.edit','events.publish',
 'schedules.manage','audit.read']),false)
 and exists(select 1 from public.admin_accounts a where a.user_id=auth.uid() and a.active
 and (a.role not in ('owner','administrator') or auth.jwt()->>'aal'='aal2')
 and (a.role='owner' or exists(select 1 from public.admin_grants g where
 g.user_id=a.user_id and g.permission=permission_name
 and (g.ministry_id is null or g.ministry_id=scope_id))));
$$;
revoke all on function private.allowed(text,uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.allowed(text,uuid) to authenticated;
create table public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 200),
 summary text not null default '' check(length(summary)<=1000),
 body text not null default '' check(length(body)<=30000),
 title_ar text not null default '', body_ar text not null default '',
 ministry_id uuid references public.ministries(id),
 status text not null default 'draft' check(status in ('draft','pending_review','published','archived')),
 placement text not null default 'announcements' check(placement in ('announcements','homepage','site_banner','ministry')),
 publish_at timestamptz not null default now(), expires_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(expires_at is null or expires_at>publish_at)
);
create table public.events (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 200),
 body text not null default '', location text not null default '',
 ministry_id uuid references public.ministries(id),
 start_at timestamptz not null, end_at timestamptz,
 status text not null default 'draft' check(status in ('draft','pending_review','published','cancelled','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_at is null or end_at>start_at)
);
create table public.recurring_event_series (
 id text primary key check(id ~ '^[a-z0-9-]+$'),
 title text not null, ministry_id uuid references public.ministries(id),
 weekday integer not null check(weekday between 0 and 6),
 local_start_time time not null, local_end_time time,
 start_date date not null, end_date date,
 timezone text not null default 'America/Chicago' check(timezone='America/Chicago'),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 updated_at timestamptz not null default now(),
 check(end_date is null or end_date>=start_date),
 check(local_end_time is null or local_end_time>local_start_time)
);
create table public.event_exceptions (
 id uuid primary key default gen_random_uuid(),
 series_id text not null references public.recurring_event_series(id),
 original_date date not null, cancelled boolean not null default false,
 replacement_date date, replacement_start time, replacement_end time,
 reason text not null default '',
 updated_at timestamptz not null default now(),
 unique(series_id,original_date),
 check(replacement_end is null or (replacement_start is not null and replacement_end>replacement_start))
);
create table public.audit_logs (
 id bigint generated always as identity primary key,
 actor uuid, action text not null, entity text not null, entity_id text,
 occurred_at timestamptz not null default now(),
 before_state jsonb, after_state jsonb
);
-- Updating a single counter row serializes owner changes even under repeatable read.
create table private.owner_state (
 singleton boolean primary key default true check(singleton),
 active_count integer not null default 0 check(active_count >= 0),
 bootstrapped boolean not null default false,
 check(not bootstrapped or active_count > 0)
);
insert into private.owner_state(singleton) values(true);
alter table private.owner_state enable row level security;
revoke all on private.owner_state from public, anon, authenticated;
create function private.audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 before_row jsonb;
 after_row jsonb;
 safe_keys text[] := array['id','user_id','role','active','permission','ministry_id',
 'status','placement','publish_at','expires_at','start_at','end_at','weekday',
 'local_start_time','local_end_time','start_date','end_date','series_id',
 'original_date','cancelled','replacement_date','replacement_start','replacement_end'];
begin
 if TG_OP <> 'INSERT' then before_row := to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then after_row := to_jsonb(new); end if;
 insert into public.audit_logs(actor,action,entity,entity_id,before_state,after_state)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,
 coalesce(after_row->>'id',after_row->>'user_id',before_row->>'id',before_row->>'user_id'),
 (select jsonb_object_agg(key,value) from jsonb_each(before_row) where key=any(safe_keys)),
 (select jsonb_object_agg(key,value) from jsonb_each(after_row) where key=any(safe_keys)));
 if TG_OP = 'DELETE' then return old; end if;
 return new;
end $$;
create function private.content_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 publishing boolean;
 edit_permission text;
 publish_permission text;
 parish_placement boolean := false;
begin
 case TG_TABLE_NAME
 when 'announcements' then
   edit_permission := 'announcements.edit';
   publish_permission := 'announcements.publish';
   parish_placement := new.placement in ('homepage','site_banner');
 when 'events' then
   edit_permission := 'events.edit';
   publish_permission := 'events.publish';
 else raise exception 'Unsupported content table';
 end case;
 if TG_OP='UPDATE' then
   if new.id is distinct from old.id then raise exception 'Record identity is immutable'; end if;
   new.created_at := old.created_at;
 else
   new.created_at := now();
 end if;
 new.updated_at:=now();
 -- Trusted SQL setup may write content. A missing JWT is never itself a bypass.
 if current_user in ('postgres','supabase_admin','service_role') then return new; end if;
 if not private.allowed(edit_permission,new.ministry_id) then
   raise exception 'Editing permission required' using errcode='42501';
 end if;
 if TG_OP='UPDATE' then
   if new.ministry_id is distinct from old.ministry_id then
     raise exception 'Reassignment requires a trusted administration operation' using errcode='42501';
   end if;
   if TG_TABLE_NAME='announcements' then
     parish_placement := parish_placement or old.placement in ('homepage','site_banner');
   end if;
 end if;
 publishing := new.status in ('published','archived','cancelled');
 if TG_OP='UPDATE' then publishing := publishing or old.status in ('published','archived','cancelled'); end if;
 if publishing and not private.allowed(publish_permission,new.ministry_id) then
   raise exception 'Publishing permission required' using errcode='42501';
 end if;
 if parish_placement and not private.allowed('announcements.publish',null) then
   raise exception 'Parish-wide placement requires parish-wide permission' using errcode='42501';
 end if;
 return new;
end $$;
create function private.last_owner_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 old_count integer := 0;
 new_count integer := 0;
begin
 if TG_OP <> 'INSERT' then
   old_count := case when old.role='owner' and old.active then 1 else 0 end;
 end if;
 if TG_OP <> 'DELETE' then
   new_count := case when new.role='owner' and new.active then 1 else 0 end;
 end if;
 if new_count <> old_count then
   update private.owner_state
   set active_count=active_count + new_count - old_count,
       bootstrapped=bootstrapped or new_count>0
   where singleton;
   if not found then raise exception 'Owner protection state is missing'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
create trigger protect_owner after insert or update or delete on public.admin_accounts for each row execute function private.last_owner_guard();
do $$
declare tab text;
begin
 foreach tab in array array['admin_accounts','admin_grants','ministries','announcements','events','recurring_event_series','event_exceptions','audit_logs'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public, anon, authenticated',tab);
 if tab<>'audit_logs' then
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',tab);
 end if;
 end loop;
end $$;
revoke all on sequence public.audit_logs_id_seq from public, anon, authenticated;
grant select on public.admin_accounts,public.admin_grants,public.ministries to authenticated;
create policy self_account on public.admin_accounts for select to authenticated using(user_id=auth.uid());
create policy self_grants on public.admin_grants for select to authenticated using(user_id=auth.uid() and private.allowed(permission,ministry_id));
create policy ministry_read on public.ministries for select to authenticated using(exists(
 select 1 from public.admin_accounts where user_id=auth.uid() and active
 and (role not in ('owner','administrator') or auth.jwt()->>'aal'='aal2')));
grant select,insert,update on public.announcements,public.events to authenticated;
create policy announcement_read on public.announcements for select to authenticated using(private.allowed('announcements.edit',ministry_id));
create policy announcement_insert on public.announcements for insert to authenticated with check(private.allowed('announcements.edit',ministry_id));
create policy announcement_update on public.announcements for update to authenticated using(private.allowed('announcements.edit',ministry_id)) with check(private.allowed('announcements.edit',ministry_id));
create policy event_read on public.events for select to authenticated using(private.allowed('events.edit',ministry_id));
create policy event_insert on public.events for insert to authenticated with check(private.allowed('events.edit',ministry_id));
create policy event_update on public.events for update to authenticated using(private.allowed('events.edit',ministry_id)) with check(private.allowed('events.edit',ministry_id));
create trigger announcement_guard before insert or update on public.announcements for each row execute function private.content_guard();
create trigger event_guard before insert or update on public.events for each row execute function private.content_guard();
grant select,insert,update on public.recurring_event_series,public.event_exceptions to authenticated;
create policy series_read on public.recurring_event_series for select to authenticated using(private.allowed('schedules.manage',null));
create policy series_insert on public.recurring_event_series for insert to authenticated with check(private.allowed('schedules.manage',null));
create policy series_update on public.recurring_event_series for update to authenticated using(private.allowed('schedules.manage',null)) with check(private.allowed('schedules.manage',null));
create policy exception_read on public.event_exceptions for select to authenticated using(private.allowed('schedules.manage',null));
create policy exception_insert on public.event_exceptions for insert to authenticated with check(private.allowed('schedules.manage',null));
create policy exception_update on public.event_exceptions for update to authenticated using(private.allowed('schedules.manage',null)) with check(private.allowed('schedules.manage',null));
grant select on public.audit_logs to authenticated;
create policy audit_read on public.audit_logs for select to authenticated using(private.allowed('audit.read',null));
create function public.published_announcements()
returns table(id uuid,title text,summary text,body text,title_ar text,body_ar text,ministry_id uuid,placement text,publish_at timestamptz)
language sql stable security definer set search_path='' as $$
 select id,title,summary,body,title_ar,body_ar,ministry_id,placement,publish_at
 from public.announcements where status='published' and publish_at<=now()
 and (expires_at is null or expires_at>now()) order by publish_at desc,id limit 100;
$$;
revoke all on function public.published_announcements() from public, anon, authenticated;
grant execute on function public.published_announcements() to anon,authenticated;
revoke all on function private.audit_change(),private.content_guard(),private.last_owner_guard() from public, anon, authenticated;
commit;

