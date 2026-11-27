-- Run manually in the trusted Supabase SQL Editor after reviewing the invited user.
-- This is an operator script, not an exposed function or an automatic migration.
begin;
do $$
declare
  owner_id uuid := 'REPLACE-WITH-INVITED-USER-UUID';
  owner_email text := 'REPLACE-WITH-VERIFIED-OWNER-EMAIL';
  already_bootstrapped boolean;
begin
  if current_user not in ('postgres','supabase_admin') then
    raise exception 'Use a trusted database administrator session';
  end if;
  select bootstrapped into already_bootstrapped
  from private.owner_state where singleton for update;
  if not found or already_bootstrapped
     or exists(select 1 from public.admin_accounts where role='owner' and active) then
    raise exception 'First-owner setup is unavailable. Use the documented ownership-transfer procedure.';
  end if;
  if not exists(select 1 from auth.users where id=owner_id
      and lower(email)=lower(owner_email) and deleted_at is null
      and (invited_at is not null or email_confirmed_at is not null)) then
    raise exception 'Verify the invited user UUID and email before assigning ownership';
  end if;
  insert into public.admin_accounts(user_id,role,active) values(owner_id,'owner',true);
end $$;
commit;

