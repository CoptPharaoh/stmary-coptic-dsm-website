begin;
grant usage on schema public to anon, authenticated;
-- All browser access remains limited by explicit object grants and RLS.
revoke all on sequence public.audit_logs_id_seq from anon, authenticated;

create function public.parish_calendar_data(range_start date, range_end date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if range_start is null or range_end is null or range_end<=range_start or range_end-range_start>370 then
 raise exception 'Request between 1 and 370 days'; end if;
 return jsonb_build_object(
 'services',coalesce((select jsonb_agg(jsonb_build_object(
 'id',id,'title',title,'weekday',weekday,'start',to_char(local_start_time,'HH24:MI'),
 'end',to_char(local_end_time,'HH24:MI'),'startDate',start_date,'endDate',end_date))
 from public.recurring_event_series where status='published'),'[]'::jsonb),
 'exceptions',coalesce((select jsonb_object_agg(e.series_id||'@'||e.original_date,
 jsonb_strip_nulls(jsonb_build_object('cancelled',e.cancelled,'date',e.replacement_date,
 'start',to_char(e.replacement_start,'HH24:MI'),'end',to_char(e.replacement_end,'HH24:MI'),'note',e.reason)))
 from public.event_exceptions e join public.recurring_event_series s on s.id=e.series_id
 where s.status='published' and
 (e.original_date>=range_start and e.original_date<range_end or
 e.replacement_date>=range_start and e.replacement_date<range_end)),'{}'::jsonb),
 'specialEvents',coalesce((select jsonb_agg(jsonb_build_object(
 'id',id,'title',case when status='cancelled' then 'Cancelled: '||title else title end,
 'date',to_char(start_at at time zone 'America/Chicago','YYYY-MM-DD'),
 'start',to_char(start_at at time zone 'America/Chicago','HH24:MI'),
 'end',case when (end_at at time zone 'America/Chicago')::date=(start_at at time zone 'America/Chicago')::date
 then to_char(end_at at time zone 'America/Chicago','HH24:MI') end,
 'note',concat_ws(' · ',nullif(location,''),nullif(body,''))))
 from public.events where status in ('published','cancelled')
 and start_at>=range_start::timestamp at time zone 'America/Chicago'
 and start_at<range_end::timestamp at time zone 'America/Chicago'),'[]'::jsonb));
end $$;
revoke all on function public.parish_calendar_data(date,date) from public;
grant execute on function public.parish_calendar_data(date,date) to anon,authenticated;
create index announcements_public_window on public.announcements(status,publish_at,expires_at);
create index events_public_time on public.events(status,start_at);
create index grants_user on public.admin_grants(user_id);
create function private.validate_occurrence() returns trigger
language plpgsql set search_path='' as $$
declare series public.recurring_event_series;
begin
 select * into series from public.recurring_event_series where id=new.series_id;
 if extract(dow from new.original_date)<>series.weekday
 or new.original_date<series.start_date
 or (series.end_date is not null and new.original_date>series.end_date) then
 raise exception 'The original date is outside the recurring schedule';
 end if;
 return new;
end $$;
revoke all on function private.validate_occurrence() from public;
create trigger validate_occurrence before insert or update on public.event_exceptions
for each row execute function private.validate_occurrence();
commit;

