# Administration setup

This is an unconfigured initial implementation on clean-rebuild. Apply it to a development Supabase project first. Authentication, SQL policies, invitations, and live publishing have not been tested against a database.

## Create a development project

Create a Supabase organization and development project in the Supabase dashboard. Keep production in a separate project. Record the database password in the parish's approved password manager.

Review supabase/migrations/202611150001_admin_foundation.sql, then apply it once using the SQL editor or Supabase CLI migration workflow. The migration is transactional. It creates new tables and does not migrate existing parish content.

In js/supabase-config.js supply the HTTPS project URL and sb_publishable_ key from the project API settings. These values are public. Never place a secret key, service-role key, or database password there. Netlify environment variables are not automatically injected into JavaScript. This release uses an explicitly configured static module.

## Authentication

Disable new user signup in Supabase Auth. Configure SMTP and test delivery before inviting staff. Enable TOTP MFA. Set the production Site URL to the approved production origin. Add exact redirect URLs for /admin/index.html on production and the chosen localhost port. Use a separate project for previews and allow only approved preview origins.

Invite the initial owner through Supabase's trusted Auth dashboard. After locating the user's UUID, execute this reviewed SQL in the SQL editor, replacing the placeholder with that UUID:

```sql
insert into public.admin_accounts(user_id,role)
values ('OWNER-UUID-HERE','owner');
```

The invitation returns to admin/index.html to set a password. Owners and administrators must enroll and verify an authenticator to access content. Save the parish's recovery procedures outside the website. A trusted Supabase project administrator can recover an account through Auth administration after verifying the person's identity.

Create other accounts by invitation, add an admin_accounts row, and issue grants. Administrators receive no automatic content permission. Grant each capability deliberately. A null ministry_id means parish-wide scope. A ministry UUID limits the permission to that ministry.

```sql
insert into public.ministries(name,slug) values ('Deacons School','deacons-school');
-- Supply real UUIDs from the created records.
insert into public.admin_accounts(user_id,role) values ('USER-UUID','servant');
insert into public.admin_grants(user_id,permission,ministry_id)
values ('USER-UUID','announcements.edit','MINISTRY-UUID');
```

Issue announcements.publish separately when approved. Users cannot change their roles or grants via the browser API. Revoke grants or set active=false to remove access. Ownership transfer is a trusted SQL operation: establish the replacement owner first, then demote the prior owner. A trigger protects the last active owner.

## Preview and hosting

Run a static HTTP server from the repository, then open /admin/index.html. ES modules require HTTP. For example, python3 -m http.server 4176. Public content is at /announcements.html.

No frontend build is needed. The client imports pinned supabase-js 2.119.0 from jsDelivr. Verify that the production CSP permits the approved module source and the configured Supabase HTTPS/WebSocket endpoints before release. No Netlify settings have been changed.

## Required verification

Use separate real accounts for owner, administrator, editor, servant, disabled user, and unaffiliated authenticated user. Test direct REST operations as well as the UI. Verify ministry isolation, publishing denial, future/expired announcement visibility, grant escalation denial, MFA requirements, and revocation. Test invitation acceptance and reset links in fresh browsers and after expiration.

Review project backup availability for the selected Supabase plan. Export and protect a database backup before schema changes. Rehearse restore into an isolated project. Treat Auth recovery and database restore as separate procedures.

## Integration boundary

Public announcement listing is implemented. Homepage placement, site banners, ministry feeds, and live calendar synchronization are pending. Existing public calendars still use js/parish-schedule.js. Calendar series and exception tables are prepared but have no admin UI or public RPC. Do not populate them expecting the public calendar to change.

The existing engine uses local dates/times in America/Chicago, weekly weekday rules, exceptions keyed by series ID plus original date, and bounded month rendering. It already exports static ICS downloads. Keep this engine when connecting live data.

Schedule migration must copy the five records and existing exceptions from js/parish-schedule.js. Select the effective start date when migration is authorized. Preserve unknown Saturday end times. Use stable existing IDs and INSERT ... ON CONFLICT DO NOTHING in the reviewed migration seed. No effective start date or seed has been applied.

Monthly recurrence, series splitting, invitations from the portal, media upload, recurring calendar UI, subscriptions, and production security validation remain future implementation work.

