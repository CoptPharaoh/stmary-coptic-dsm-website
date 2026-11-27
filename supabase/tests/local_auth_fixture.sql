-- LOCAL TEST HARNESS ONLY. Never apply this file to a Supabase project.
-- Minimal Auth surface and deliberately permissive Supabase-style default grants.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
 id uuid primary key,
 email text,
 aud text,
 role text,
 email_confirmed_at timestamptz,
 invited_at timestamptz,
 deleted_at timestamptz
);
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(auth.jwt()->>'sub','')::uuid
$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.jwt(),auth.uid() to anon,authenticated,service_role;
grant usage,create on schema public to public;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
alter default privileges in schema public grant all on functions to anon,authenticated,service_role;

