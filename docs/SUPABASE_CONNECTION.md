# Connect the St. Mary Supabase project

Project reference: qkwclybpzzxsxelwafnv
Project URL: https://qkwclybpzzxsxelwafnv.supabase.co

The public URL and publishable key are configured in js/supabase-config.js. No server credentials are needed by the static site. Keep development previews isolated from this project if it becomes production.

## Apply migrations in this exact order

Open the project's SQL Editor and run each complete file separately, confirming success before continuing:

1. supabase/migrations/202611150001_admin_foundation.sql
2. supabase/migrations/202611150002_public_calendar.sql
3. supabase/migrations/202611150003_confirmed_schedule.sql

The first two migrations create new objects and should run once. The third seed may run again safely because stable IDs use ON CONFLICT DO NOTHING. It will not overwrite later administrator changes.

Effective start date is November 15, 2026. Review this date before applying the third migration. All five services retain their confirmed Central Time start times. Sunday ends 11:30 AM, Wednesday ends 10:00 AM, and Saturday end times remain null. No exceptions are present in the current local schedule to migrate.

If using the CLI instead of SQL Editor, from the repository:

```sh
supabase login
supabase init
supabase link --project-ref qkwclybpzzxsxelwafnv
supabase db push --dry-run
supabase db push
```

Review the dry run before pushing. Authenticate interactively and keep passwords out of source files. If SQL Editor was used, do not run db push blindly. Mark each already-applied migration as applied with supabase migration repair --status applied VERSION after confirming its objects and SQL match.

## Auth configuration

In Authentication settings disable Allow new users to sign up. Keep email/password enabled. Configure an approved SMTP provider and test delivery. Enable TOTP MFA.

Set the Site URL to the approved deployment origin. Allow these exact redirects:
- http://127.0.0.1:4176/admin/index.html
- https://stmary-coptic-dsm-dev.netlify.app/admin/index.html

Add localhost separately only if actually used. Avoid wildcard preview URLs. The app uses /admin/index.html for invitations and password recovery.

Invite the priest/owner through Authentication > Users > Invite user. Independently verify the intended person's email and copy the UUID from that exact Auth user record. Open supabase/setup/first_owner.sql, replace both UUID and email placeholders, review it, then run it in the trusted SQL Editor as postgres. This operator script is separate from the migrations. It locks the owner invariant, verifies the invited/confirmed account, and refuses reuse after the first owner has been established. Never expose it as a browser RPC.

Owners receive all content permissions through the database helper, contingent on active status and MFA aal2. No additional grants are needed. The browser cannot assign owner status. Accept the invitation, set a unique password, then enroll and verify the authenticator. Keep a documented recovery procedure with the authorized Supabase project administrators.

Keep at least one active owner. For transfer, an authorized project administrator first inserts a second verified owner's account through trusted SQL, confirms that person's MFA login, then demotes the outgoing owner. The counter constraint rejects removal or disabling of the final active owner, including concurrent transactions. Disabling an account in Auth alone is insufficient for immediate revocation of an already-issued JWT. Also set admin_accounts.active=false. A project administrator may recover Auth MFA after verifying identity; do not disable the database's MFA policy.

Invite other accounts through the same trusted Auth administration process. Insert their account with administrator, editor, or servant role, then insert explicit admin_grants. Publishing is separate from editing. Use the appropriate ministries.id for scoped access. A null scope grants parish-wide authority. Disable access with active=false. Do not demote the sole active owner.

## Database security settings

Keep public exposed to the Data API. Keep private unexposed. The SQL explicitly grants schema access, table privileges, and RPC execution. RLS protects all application tables. Anonymous users receive RPC execution only and no underlying table reads/writes. Public RPCs return only published content. The grants helper reads protected database roles and scopes, not user-editable Auth metadata.

## Local testing

Run python3 -m http.server 4176 from the site directory. Open:
- /admin/index.html
- /announcements.html
- /events.html
- /deacons.html
- /index.html

Confirm login, reset, invitation acceptance, MFA, logout, and session expiration with actual accounts. Create an announcement draft. Check that anonymous visitors cannot see it. Publish it to the announcements placement and confirm it appears without a rebuild. Set a future publication time and an expiration time and verify the visibility boundaries.

Create a one-time event and publish it. Verify it in the public calendar. Under Recurring weekly services, load a series and test one cancellation and one reschedule. Confirm unaffected occurrences retain their original time. Revert test changes before using real parish data. Check the homepage and Deacons School next-session display.

Verify every direct REST denial using owner, administrator, editor, scoped servant, disabled, and unaffiliated accounts. Check anonymous table writes, cross-ministry changes, unauthorized publication, and self-granted roles. Owners at aal1 must fail protected content requests. Browser behavior alone does not prove these controls.

Run node scripts/test-parish-calendar.cjs for existing recurrence, exception, DST, and ICS regression checks.

After the reviewed migrations are approved and applied to an isolated test project, run supabase/tests/security_review.sql as postgres before creating a real owner there. It uses temporary test identities, simulates API roles/claims, asserts expected denials, and rolls back its fixtures. The suite and automated concurrency tests passed on disposable local PostgreSQL 17.7 with Supabase-compatible Auth/role fixtures on November 22, 2026. See docs/SECURITY.md for reproduction and the remaining real-token REST tests. The parish's live Supabase project was not contacted.

## Current integration and limitations

Announcements page and admin announcement/event forms use Supabase. Public calendar, homepage upcoming list, and Deacons next session load the same calendar RPC and existing recurrence engine. Recurring service edits and occurrence cancellation/rescheduling are available to schedules.manage.

Reads occur on page load and when browsing calendar months. Refresh after saving to see updates. There are no realtime subscriptions. When unavailable, public calendar views show the baseline schedule with a visible warning. Empty database results are treated as empty, not failures.

Homepage announcement placement, banner placement, ministry announcement feeds, monthly recurrence, new-series creation UI, series splitting, user-management UI, and live subscription feeds remain pending. Static schedule prose on other pages is not database-driven. Multi-day one-time events appear on their start date; cross-day end times are not exported by the current ICS renderer. Weekly series ICS exports do not yet express effective end dates, so use individual-event exports for bounded series.

Migration execution, RLS enforcement, authentication flows, production email settings, and authenticated browser interactions require testing after the migrations are applied. No live database changes have been made by this implementation.

