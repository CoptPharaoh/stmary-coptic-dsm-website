begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
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
 select exists(select 1 from public.admin_accounts a where a.user_id=auth.uid() and a.active
 and (a.role not in ('owner','administrator') or auth.jwt()->>'aal'='aal2')
 and (a.role='owner' or exists(select 1 from public.admin_grants g where
 g.user_id=a.user_id and g.permission=permission_name
 and (g.ministry_id is null or g.ministry_id=scope_id))));
$$;
revoke all on function private.allowed(text,uuid) from public;
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
 occurred_at timestamptz not null default now()
);
create function private.audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor,action,entity,entity_id)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id'));
 return new;
end $$;
create function private.content_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare publishing boolean;
begin
 if auth.uid() is null then return new; end if;
 if TG_OP='UPDATE' and new.ministry_id is distinct from old.ministry_id then
   raise exception 'Reassignment requires a trusted administration operation';
 end if;
 publishing := new.status in ('published','archived','cancelled');
 if TG_OP='UPDATE' then publishing := publishing or old.status in ('published','archived','cancelled'); end if;
 if publishing and not private.allowed(TG_TABLE_NAME||'.publish',new.ministry_id) then
   raise exception 'Publishing permission required';
 end if;
 if TG_TABLE_NAME='announcements' then
   if to_jsonb(new)->>'placement' in ('homepage','site_banner')
      and not private.allowed('announcements.publish',null) then
     raise exception 'Parish-wide placement requires parish-wide permission';
   end if;
 end if;
 new.updated_at:=now();
 return new;
end $$;
create function private.last_owner_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(735821);
 if old.role='owner' and old.active and (TG_OP='DELETE' or new.role<>'owner' or not new.active)
 and not exists(select 1 from public.admin_accounts where role='owner' and active and user_id<>old.user_id)
 then raise exception 'Cannot remove the last active owner'; end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
create trigger protect_owner before update or delete on public.admin_accounts for each row execute function private.last_owner_guard();
do $$
declare tab text;
begin
 foreach tab in array array['admin_accounts','admin_grants','ministries','announcements','events','recurring_event_series','event_exceptions','audit_logs'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from anon, authenticated',tab);
 if tab<>'audit_logs' then
 execute format('create trigger audit_change after insert or update on public.%I for each row execute function private.audit_change()',tab);
 end if;
 end loop;
end $$;
grant select on public.admin_accounts,public.admin_grants,public.ministries to authenticated;
create policy self_account on public.admin_accounts for select to authenticated using(user_id=auth.uid());
create policy self_grants on public.admin_grants for select to authenticated using(user_id=auth.uid());
create policy ministry_read on public.ministries for select to authenticated using(exists(select 1 from public.admin_accounts where user_id=auth.uid() and active));
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
create policy series_manage on public.recurring_event_series for all to authenticated using(private.allowed('schedules.manage',null)) with check(private.allowed('schedules.manage',null));
create policy exception_manage on public.event_exceptions for all to authenticated using(private.allowed('schedules.manage',null)) with check(private.allowed('schedules.manage',null));
grant select on public.audit_logs to authenticated;
create policy audit_read on public.audit_logs for select to authenticated using(private.allowed('audit.read',null));
create function public.published_announcements()
returns table(id uuid,title text,summary text,body text,title_ar text,body_ar text,ministry_id uuid,placement text,publish_at timestamptz)
language sql stable security definer set search_path='' as $$
 select id,title,summary,body,title_ar,body_ar,ministry_id,placement,publish_at
 from public.announcements where status='published' and publish_at<=now()
 and (expires_at is null or expires_at>now()) order by publish_at desc limit 100;
$$;
revoke all on function public.published_announcements() from public;
grant execute on function public.published_announcements() to anon,authenticated;
revoke all on function private.audit_change(),private.content_guard(),private.last_owner_guard() from public;
commit;

