-- Run only in an isolated test project AFTER reviewed migrations 001, 002, and 003.
-- Requires a trusted postgres connection and a test database without a real owner.
-- All fixture data and helper functions are rolled back. No Auth emails are sent.
begin;
create temporary table security_test_session(marker boolean);
do $$ begin
 execute format('grant usage on schema %I to anon, authenticated',
   (select nspname from pg_namespace where oid=pg_my_temp_schema()));
 if (select bootstrapped from private.owner_state where singleton) then
   raise exception 'Use a fresh test project without a real owner';
 end if;
end $$;
create function pg_temp.assert_true(ok boolean, label text)
returns void language plpgsql as $$
begin
 if ok is distinct from true then raise exception 'FAILED: %',label; end if;
end $$;
create function pg_temp.expect_error(statement text, expected_code text default '42501')
returns void language plpgsql security invoker as $$
begin
 begin
   execute statement;
 exception when others then
   if sqlstate=expected_code then return; end if;
   raise exception 'Unexpected SQLSTATE % (expected %) for %: %',sqlstate,expected_code,statement,sqlerrm;
 end;
 raise exception 'Expected denial for %',statement;
end $$;
grant execute on function pg_temp.assert_true(boolean,text),pg_temp.expect_error(text,text) to anon,authenticated;

insert into auth.users(id,email,aud,role,email_confirmed_at)
select ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 'sql-review-'||n||'@example.invalid','authenticated','authenticated',now()
from generate_series(1,8) n;
insert into public.admin_accounts(user_id,role,active) values
('10000000-0000-0000-0000-000000000001','owner',true),
('10000000-0000-0000-0000-000000000002','administrator',true),
('10000000-0000-0000-0000-000000000003','editor',true),
('10000000-0000-0000-0000-000000000004','servant',true),
('10000000-0000-0000-0000-000000000006','editor',false),
('10000000-0000-0000-0000-000000000007','servant',true);
insert into public.ministries(id,name,slug) values
('20000000-0000-0000-0000-000000000001','Test A','security-test-a'),
('20000000-0000-0000-0000-000000000002','Test B','security-test-b');
insert into public.admin_grants(user_id,permission,ministry_id)
select ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,permission,
 case when n in (4,7) then '20000000-0000-0000-0000-000000000001'::uuid end
from (values (2),(3),(4),(6),(7)) users(n)
cross join (values ('announcements.edit'),('events.edit')) permissions(permission);
insert into public.admin_grants(user_id,permission,ministry_id) values
('10000000-0000-0000-0000-000000000007','announcements.publish','20000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000007','events.publish','20000000-0000-0000-0000-000000000001');
insert into public.announcements(id,title,ministry_id,status,placement,publish_at,expires_at) values
('30000000-0000-0000-0000-000000000001','Current','20000000-0000-0000-0000-000000000001','published','announcements',now()-interval '1 day',null),
('30000000-0000-0000-0000-000000000002','Future',null,'published','announcements',now()+interval '1 day',null),
('30000000-0000-0000-0000-000000000003','Expired',null,'published','announcements',now()-interval '2 days',now()-interval '1 day'),
('30000000-0000-0000-0000-000000000004','Draft B','20000000-0000-0000-0000-000000000002','draft','announcements',now(),null),
('30000000-0000-0000-0000-000000000005','Parish banner','20000000-0000-0000-0000-000000000001','published','site_banner',now(),null);

-- Actual grants must deny access even before evaluating RLS.
select pg_temp.assert_true(not has_table_privilege('anon','public.announcements','SELECT'),'anonymous table privilege');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.admin_accounts','UPDATE'),'role escalation privilege');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.audit_logs','INSERT'),'audit forging');
select pg_temp.assert_true(not has_sequence_privilege('authenticated','public.audit_logs_id_seq','USAGE'),'audit sequence');
select pg_temp.assert_true(not has_schema_privilege('authenticated','public','CREATE'),'schema creation');
select pg_temp.assert_true(not has_function_privilege('anon','private.allowed(text,uuid)','EXECUTE'),'anonymous helper');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.content_guard()','EXECUTE'),'content guard execution');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.audit_change()','EXECUTE'),'audit trigger execution');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.last_owner_guard()','EXECUTE'),'owner trigger execution');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.validate_occurrence()','EXECUTE'),'schedule trigger execution');
select pg_temp.assert_true(
 (select bool_and(relrowsecurity) from pg_class where oid in
 ('public.admin_accounts'::regclass,'public.admin_grants'::regclass,'public.ministries'::regclass,
  'public.announcements'::regclass,'public.events'::regclass,'public.recurring_event_series'::regclass,
  'public.event_exceptions'::regclass,'public.audit_logs'::regclass)),'RLS enabled');
select pg_temp.assert_true(
 (select bool_and(coalesce(proconfig @> array['search_path=""'],false))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.prosecdef),'definer search paths');
-- Check every exposed table, not just representative content tables.
do $$
declare tab text; operation text;
begin
 foreach tab in array array['admin_accounts','admin_grants','ministries','announcements',
 'events','recurring_event_series','event_exceptions','audit_logs'] loop
   foreach operation in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES'] loop
     perform pg_temp.assert_true(not has_table_privilege('anon','public.'||tab,operation),
       'anonymous '||operation||' on '||tab);
   end loop;
   foreach operation in array array['DELETE','TRUNCATE','TRIGGER','REFERENCES'] loop
     perform pg_temp.assert_true(not has_table_privilege('authenticated','public.'||tab,operation),
       'authenticated '||operation||' on '||tab);
   end loop;
 end loop;
 foreach tab in array array['admin_accounts','admin_grants','ministries','audit_logs'] loop
   foreach operation in array array['INSERT','UPDATE'] loop
     perform pg_temp.assert_true(not has_table_privilege('authenticated','public.'||tab,operation),
       'protected '||operation||' on '||tab);
   end loop;
 end loop;
end $$;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.expect_error('select * from public.admin_accounts');
select pg_temp.expect_error('select * from public.announcements');
select pg_temp.expect_error('insert into public.announcements(title) values (''attack'')');
select pg_temp.assert_true((select count(*)=2 from public.published_announcements()),'publication windows');
select pg_temp.expect_error($q$select public.parish_calendar_data('infinity','infinity')$q$,'P0001');
select pg_temp.expect_error($q$select public.parish_calendar_data('2027-01-01','2029-01-01')$q$,'P0001');
reset role;

-- Owner without MFA cannot read content or write schedules.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1","sub":"10000000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true(not private.allowed('announcements.edit',null),'owner MFA');
select pg_temp.assert_true((select count(*)=0 from public.announcements),'owner aal1 rows');
select pg_temp.expect_error($q$insert into public.announcements(title) values ('aal1')$q$);
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"10000000-0000-0000-0000-000000000001"}',true);
select pg_temp.assert_true(private.allowed('announcements.publish',null),'owner publishing');
select pg_temp.assert_true(not private.allowed('announcement.publish',null),'unknown permission denied');
select pg_temp.assert_true(not private.allowed(null,null),'null permission denied');
select pg_temp.expect_error($q$insert into public.admin_grants(user_id,permission) values ('10000000-0000-0000-0000-000000000001','audit.read')$q$);
select pg_temp.expect_error('delete from public.audit_logs');
select pg_temp.assert_true((select count(*)=1 from public.admin_accounts),'self-account visibility');
select pg_temp.assert_true((select count(*)>0 from public.audit_logs),'owner audit read');
insert into public.announcements(title,status) values ('Owner published','published');
update public.announcements set status='archived' where title='Owner published';
select pg_temp.assert_true(exists(select 1 from public.audit_logs where entity='announcements'
 and action='UPDATE' and before_state->>'status'='published'
 and after_state->>'status'='archived'),'update audit');
reset role;

-- Administrator requires MFA and explicit grants. Role alone gives no publishing rights.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1","sub":"10000000-0000-0000-0000-000000000002"}',true);
select pg_temp.assert_true(not private.allowed('announcements.edit',null),'administrator MFA');
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"10000000-0000-0000-0000-000000000002"}',true);
select pg_temp.assert_true(private.allowed('announcements.edit',null),'administrator explicit edit');
select pg_temp.expect_error($q$insert into public.announcements(title,status) values ('admin publish','published')$q$);
reset role;

-- Editors can submit drafts but cannot publish, archive, cancel, or modify published records.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1","sub":"10000000-0000-0000-0000-000000000003"}',true);
insert into public.announcements(title,status) values ('Editor draft','pending_review');
select pg_temp.expect_error($q$insert into public.announcements(title,status) values ('publish','published')$q$);
select pg_temp.expect_error($q$update public.announcements set body='changed' where id='30000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_error($q$update public.announcements set status='draft' where id='30000000-0000-0000-0000-000000000001'$q$);
select pg_temp.expect_error($q$insert into public.events(title,start_at,status) values ('cancelled',now(),'cancelled')$q$);
select pg_temp.expect_error($q$insert into public.events(title,start_at,status) values ('published',now(),'published')$q$);
select pg_temp.expect_error($q$update public.admin_accounts set role='owner' where user_id=auth.uid()$q$);
select pg_temp.expect_error($q$insert into public.recurring_event_series(id,title,weekday,local_start_time,start_date) values ('attack','attack',0,'08:00','2027-01-01')$q$);
reset role;

-- Servants are restricted to explicitly granted ministry scopes.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1","sub":"10000000-0000-0000-0000-000000000004"}',true);
insert into public.announcements(title,ministry_id) values ('Ministry draft','20000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($q$insert into public.announcements(title,ministry_id) values ('cross scope','20000000-0000-0000-0000-000000000002')$q$);
select pg_temp.expect_error($q$insert into public.announcements(title) values ('parish scope')$q$);
select pg_temp.assert_true((select count(*)=2 from public.admin_grants),'own grant visibility');
select pg_temp.assert_true((select count(*)=0 from public.audit_logs),'servant audit denial');
select pg_temp.assert_true((select count(*)=0 from public.recurring_event_series),'servant series denial');
select pg_temp.assert_true((select count(*)=0 from public.event_exceptions),'servant exception denial');
insert into public.events(title,ministry_id,start_at)
 values ('Servant draft','20000000-0000-0000-0000-000000000001',now());
select pg_temp.expect_error($q$insert into public.events(title,ministry_id,start_at)
 values ('Cross ministry event','20000000-0000-0000-0000-000000000002',now())$q$);
select pg_temp.expect_error($q$update public.events set ministry_id='20000000-0000-0000-0000-000000000002'
 where title='Servant draft'$q$);
select pg_temp.expect_error($q$insert into public.event_exceptions(series_id,original_date,cancelled)
 values ('sunday-liturgy','2027-03-14',true)$q$);
select pg_temp.expect_error($q$update public.admin_accounts set active=false
 where user_id='10000000-0000-0000-0000-000000000001'$q$);
select pg_temp.assert_true((select count(*)=0 from public.announcements where ministry_id='20000000-0000-0000-0000-000000000002'),'cross scope reads');
with changed as (update public.announcements set title='attack' where id='30000000-0000-0000-0000-000000000004' returning id)
 select pg_temp.assert_true((select count(*)=0 from changed),'cross scope updates');
reset role;

-- Scoped publishers use the exact announcement/event grant names.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1","sub":"10000000-0000-0000-0000-000000000007"}',true);
insert into public.announcements(title,ministry_id,status) values ('Scoped published','20000000-0000-0000-0000-000000000001','published');
insert into public.events(title,ministry_id,status,start_at) values ('Scoped event','20000000-0000-0000-0000-000000000001','published','2027-03-14 08:00 America/Chicago');
select pg_temp.expect_error($q$insert into public.announcements(title,ministry_id,status,placement) values ('banner','20000000-0000-0000-0000-000000000001','published','site_banner')$q$);
select pg_temp.expect_error($q$update public.announcements set placement='ministry' where id='30000000-0000-0000-0000-000000000005'$q$);
select pg_temp.expect_error($q$update public.announcements set ministry_id=null where id='30000000-0000-0000-0000-000000000001'$q$);
reset role;

-- Revocation is checked from tables, without waiting for JWT refresh.
delete from public.admin_grants where user_id='10000000-0000-0000-0000-000000000007'
 and permission='events.publish';
set local role authenticated;
select pg_temp.expect_error($q$update public.events set body='tampered' where title='Scoped event'$q$);
reset role;

-- An authenticated stranger or disabled account has no content access.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"10000000-0000-0000-0000-000000000005"}',true);
select pg_temp.assert_true((select count(*)=0 from public.announcements),'unassigned user');
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"10000000-0000-0000-0000-000000000006"}',true);
select pg_temp.assert_true(not private.allowed('announcements.edit',null),'disabled user');
select pg_temp.assert_true((select count(*)=0 from public.admin_grants),'disabled grants');
select pg_temp.assert_true((select count(*)=0 from public.ministries),'disabled ministry metadata');
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_error($q$insert into public.announcements(title) values ('missing JWT')$q$);
reset role;

-- A scoped grant cannot satisfy a parish-wide schedules.manage request.
insert into public.admin_grants(user_id,permission,ministry_id)
 values ('10000000-0000-0000-0000-000000000002','schedules.manage','20000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2","sub":"10000000-0000-0000-0000-000000000002"}',true);
select pg_temp.assert_true(not private.allowed('schedules.manage',null),'scoped schedule grant');
reset role;
insert into public.admin_grants(user_id,permission) values
 ('10000000-0000-0000-0000-000000000002','schedules.manage');
set local role authenticated;
select pg_temp.assert_true(private.allowed('schedules.manage',null),'explicit parish-wide schedule grant');
insert into public.recurring_event_series(id,title,weekday,local_start_time,start_date)
 values ('test-draft-series','Private schedule',2,'09:00','2027-01-01');
insert into public.event_exceptions(series_id,original_date,cancelled)
 values ('test-draft-series','2027-01-05',true);
select pg_temp.assert_true((select count(*)=6 from public.recurring_event_series),'schedule manager reads');
update public.recurring_event_series set title='Private schedule revised' where id='test-draft-series';
update public.event_exceptions set reason='Changed' where series_id='test-draft-series';
reset role;

-- Last-owner updates/deletes and DELETE auditing, all rolled back.
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_error($q$delete from public.admin_accounts where user_id='10000000-0000-0000-0000-000000000001'$q$,'23514');
select pg_temp.expect_error($q$update public.admin_accounts set active=false where user_id='10000000-0000-0000-0000-000000000001'$q$,'23514');
insert into public.admin_accounts(user_id,role) values ('10000000-0000-0000-0000-000000000008','owner');
delete from public.admin_accounts where user_id='10000000-0000-0000-0000-000000000008';
select pg_temp.assert_true(exists(select 1 from public.audit_logs where action='DELETE'
 and entity='admin_accounts' and entity_id='10000000-0000-0000-0000-000000000008'
 and before_state->>'role'='owner' and after_state is null),'delete audit');
select pg_temp.assert_true((select active_count=1 and bootstrapped from private.owner_state),'owner invariant');
select pg_temp.assert_true(exists(select 1 from public.audit_logs where action='INSERT' and entity='announcements'
 and actor='10000000-0000-0000-0000-000000000003'
 and not (after_state ? 'body')),'trusted audit actor and content minimization');

-- Calendar shape, duplicate prevention, exception validation, and actual null end semantics.
select pg_temp.assert_true((select count(*)=5 from public.recurring_event_series where status='published'),'five seeded services');
select pg_temp.expect_error($q$insert into public.recurring_event_series(id,title,weekday,local_start_time,start_date)
 values ('duplicate',' Sunday Divine Liturgy ',0,'08:00','2026-11-15')$q$,'23505');
insert into public.event_exceptions(series_id,original_date,cancelled,reason)
 values ('sunday-liturgy','2027-03-14',true,'Test cancellation');
select pg_temp.expect_error($q$update public.recurring_event_series set weekday=1 where id='sunday-liturgy'$q$,'P0001');
select pg_temp.expect_error($q$insert into public.event_exceptions(series_id,original_date,cancelled) values ('sunday-liturgy','2027-03-15',true)$q$,'P0001');
insert into public.event_exceptions(series_id,original_date,replacement_date,replacement_start)
 values ('sunday-liturgy','2027-03-21','2027-03-22','09:00');
insert into public.events(title,status,start_at) values ('Private event','draft','2027-03-14 08:00 America/Chicago');
insert into public.events(title,status,start_at) values ('Winter event','published','2027-11-07 08:00 America/Chicago');
set local role anon;
select pg_temp.assert_true(jsonb_array_length(public.parish_calendar_data('2027-03-01','2027-04-01')->'services')=5,'public services');
select pg_temp.assert_true(public.parish_calendar_data('2027-03-01','2027-04-01')->'exceptions'->'sunday-liturgy@2027-03-14'->>'cancelled'='true','public cancellation');
select pg_temp.assert_true(public.parish_calendar_data('2027-03-01','2027-04-01')->'exceptions'->'sunday-liturgy@2027-03-21'->'end'='null'::jsonb,'unknown end remains null');
select pg_temp.assert_true(jsonb_array_length(public.parish_calendar_data('2027-03-01','2027-04-01')->'specialEvents')=1,'private event excluded');
select pg_temp.assert_true(public.parish_calendar_data('2027-03-01','2027-04-01')->'specialEvents'->0->>'start'='08:00','Central DST time');
select pg_temp.assert_true(public.parish_calendar_data('2027-11-01','2027-12-01')->'specialEvents'->0->>'start'='08:00','Central winter time');
reset role;

select 'Security assertions completed. Rolling back all fixtures.' as result;
rollback;

