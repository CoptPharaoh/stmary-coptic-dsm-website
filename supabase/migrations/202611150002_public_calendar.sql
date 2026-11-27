begin;
grant usage on schema public to anon, authenticated;
-- All browser access remains limited by explicit object grants and RLS.
revoke all on sequence public.audit_logs_id_seq from public, anon, authenticated;

alter table public.announcements
 add constraint announcement_finite_dates check(isfinite(publish_at) and (expires_at is null or isfinite(expires_at))),
 add constraint announcement_arabic_limits check(length(title_ar)<=200 and length(body_ar)<=30000);
alter table public.events
 add constraint event_finite_dates check(isfinite(start_at) and (end_at is null or isfinite(end_at))),
 add constraint event_text_limits check(length(body)<=30000 and length(location)<=500);
alter table public.recurring_event_series
 add constraint series_text_limit check(length(btrim(title)) between 1 and 200),
 add constraint series_supported_dates check(start_date between date '2007-01-01' and date '9999-12-31'
   and (end_date is null or end_date between start_date and date '9999-12-31')),
 add constraint series_minute_times check(extract(second from local_start_time)=0 and local_start_time<time '24:00'
   and (local_end_time is null or (extract(second from local_end_time)=0 and local_end_time<time '24:00')));
create unique index series_exact_schedule on public.recurring_event_series
 (lower(btrim(title)),weekday,local_start_time,start_date,ministry_id) nulls not distinct;
alter table public.event_exceptions
 add constraint exception_supported_dates check(original_date between date '2007-01-01' and date '9999-12-31'
   and (replacement_date is null or replacement_date between date '2007-01-01' and date '9999-12-31')),
 add constraint exception_payload check(
   (cancelled and replacement_date is null and replacement_start is null and replacement_end is null)
   or (not cancelled and replacement_date is not null and replacement_start is not null)),
 add constraint exception_minute_times check(
   (replacement_start is null or (extract(second from replacement_start)=0 and replacement_start<time '24:00'))
   and (replacement_end is null or (extract(second from replacement_end)=0 and replacement_end<time '24:00'))),
 add constraint exception_reason_limit check(length(reason)<=1000);

create function public.parish_calendar_data(range_start date, range_end date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if range_start is null or range_end is null or not isfinite(range_start) or not isfinite(range_end) then
 raise exception 'Finite dates are required'; end if;
 if range_end<=range_start or range_end-range_start>370
 or range_start<date '2007-01-01' or range_end>date '9999-12-31' then
 raise exception 'Request between 1 and 370 days'; end if;
 -- Fail rather than truncate a cancellation or silently drop a service.
 if (select count(*) from public.recurring_event_series where status='published')>500
 or (select count(*) from public.event_exceptions e
     join public.recurring_event_series s on s.id=e.series_id where s.status='published'
     and ((e.original_date>=range_start and e.original_date<range_end)
       or (e.replacement_date>=range_start and e.replacement_date<range_end)))>5000
 or (select count(*) from public.events where status in ('published','cancelled')
     and start_at >= (range_start::timestamp at time zone 'America/Chicago')
     and start_at < (range_end::timestamp at time zone 'America/Chicago'))>5000 then
 raise exception 'Calendar result limit exceeded'; end if;
 return jsonb_build_object(
 'services',coalesce((select jsonb_agg(jsonb_build_object(
 'id',id,'title',title,'weekday',weekday,'start',to_char(local_start_time,'HH24:MI'),
 'end',to_char(local_end_time,'HH24:MI'),'startDate',start_date,'endDate',end_date) order by id)
 from public.recurring_event_series where status='published'),'[]'::jsonb),
 'exceptions',coalesce((select jsonb_object_agg(e.series_id||'@'||e.original_date,
 jsonb_build_object('cancelled',e.cancelled,'date',e.replacement_date,
 'start',to_char(e.replacement_start,'HH24:MI'),'end',to_char(e.replacement_end,'HH24:MI'),'note',e.reason))
 from public.event_exceptions e join public.recurring_event_series s on s.id=e.series_id
 where s.status='published' and e.original_date>=s.start_date
 and (s.end_date is null or e.original_date<=s.end_date)
 and extract(dow from e.original_date)=s.weekday and
 (e.original_date>=range_start and e.original_date<range_end or
 e.replacement_date>=range_start and e.replacement_date<range_end)),'{}'::jsonb),
 'specialEvents',coalesce((select jsonb_agg(jsonb_build_object(
 'id',id,'title',case when status='cancelled' then 'Cancelled: '||title else title end,
 'date',to_char(start_at at time zone 'America/Chicago','YYYY-MM-DD'),
 'start',to_char(start_at at time zone 'America/Chicago','HH24:MI'),
 'end',case when (end_at at time zone 'America/Chicago')::date=(start_at at time zone 'America/Chicago')::date
 then to_char(end_at at time zone 'America/Chicago','HH24:MI') end,
 'note',concat_ws(' · ',nullif(location,''),nullif(body,''))) order by start_at,id)
 from public.events where status in ('published','cancelled')
 and start_at>=(range_start::timestamp at time zone 'America/Chicago')
 and start_at<(range_end::timestamp at time zone 'America/Chicago')),'[]'::jsonb));
end $$;
revoke all on function public.parish_calendar_data(date,date) from public, anon, authenticated;
grant execute on function public.parish_calendar_data(date,date) to anon,authenticated;
create index announcements_public_window on public.announcements(status,publish_at,expires_at);
create index events_public_time on public.events(status,start_at);
create index grants_user on public.admin_grants(user_id);
-- A transactional row update serializes series/exception validation at every isolation level.
create table private.schedule_state (
 singleton boolean primary key default true check(singleton),
 revision boolean not null default false
);
insert into private.schedule_state(singleton) values(true);
alter table private.schedule_state enable row level security;
revoke all on private.schedule_state from public,anon,authenticated;
create function private.validate_occurrence() returns trigger
language plpgsql security definer set search_path='' as $$
declare series public.recurring_event_series;
begin
 update private.schedule_state set revision=not revision where singleton;
 if not found then raise exception 'Schedule protection state is missing'; end if;
 if TG_OP='UPDATE' then
   if new.id is distinct from old.id then raise exception 'Record identity is immutable'; end if;
 end if;
 new.updated_at := now();
 if TG_TABLE_NAME='recurring_event_series' then
   -- INSERT has no children. ON CONFLICT DO NOTHING must remain seed-safe;
   -- an upsert that actually changes the series also runs this UPDATE branch.
   if TG_OP='UPDATE' and exists(select 1 from public.event_exceptions e where e.series_id=new.id and (
     extract(dow from e.original_date)<>new.weekday or e.original_date<new.start_date
     or (new.end_date is not null and e.original_date>new.end_date))) then
     raise exception 'Resolve existing exceptions before changing the series dates or weekday';
   end if;
   return new;
 end if;
 if TG_OP='UPDATE' then
   if new.series_id is distinct from old.series_id or new.original_date is distinct from old.original_date then
     raise exception 'Occurrence identity is immutable';
   end if;
 end if;
 select * into series from public.recurring_event_series where id=new.series_id;
 if not found then raise exception 'Recurring series does not exist'; end if;
 if extract(dow from new.original_date)<>series.weekday
 or new.original_date<series.start_date
 or (series.end_date is not null and new.original_date>series.end_date) then
 raise exception 'The original date is outside the recurring schedule';
 end if;
 return new;
end $$;
revoke all on function private.validate_occurrence() from public, anon, authenticated;
create trigger validate_occurrence before insert or update on public.event_exceptions
for each row execute function private.validate_occurrence();
create trigger validate_series before insert or update on public.recurring_event_series
for each row execute function private.validate_occurrence();
commit;

