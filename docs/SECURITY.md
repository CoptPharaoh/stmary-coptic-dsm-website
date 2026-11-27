# Database security review

## Review status

On November 22, 2026, all three migrations executed successfully in sequence on a fresh, disposable PostgreSQL 17.7 cluster. The automated SQL suite and concurrency tests passed. The existing corrections in migrations 001 and 002 required no further migration edits in this pass. Migration 003 retains the five original IDs, times, and effective date.

The local harness supplies a minimal auth.users table, JWT helper functions, API roles, and permissive Supabase-style default grants. It tests real PostgreSQL permissions, RLS, functions, triggers, and transactions. It does not run the full Supabase Auth service or PostgREST. No requests or migrations were executed against the parish's live project. Hosted Auth, email delivery, MFA enrollment, redirect configuration, and real-token API tests remain required.

Migration 001 is ready for a reviewed application to a fresh Supabase project using a trusted postgres migration connection. Apply 002 and 003 afterward. The local result establishes database execution and policy behavior under the stated fixture, not production readiness of the entire portal.

## Reproduce the local automated tests

The runner creates its own temporary PostgreSQL cluster with a random password and loopback-only listener, applies the repository migrations, runs the SQL suite and concurrency tests, then stops the server. It never imports the website's Supabase configuration or accepts a remote database connection.

```sh
npm install --prefix /tmp/stmary-postgres-review --no-audit --no-fund embedded-postgres@17.7.0-beta.16 pg@8.16.3
node scripts/test-admin-security.mjs /tmp/stmary-postgres-review
node scripts/test-parish-calendar.cjs
```

The embedded runtime's platform package requires its postinstall symlink hydration step. If package scripts were intentionally disabled, inspect and run the platform package's scripts/hydrate-symlinks.js from that package's directory before starting the runner.

Do not run supabase/tests/local_auth_fixture.sql in a real Supabase project. It exists only to model the required Auth/database surface in an empty local PostgreSQL instance. To test a separate Supabase staging project, apply the reviewed migrations there and run security_review.sql without local_auth_fixture.sql.

## Executed checks

- Fresh sequential application of 001, 002, and 003.
- The expanded 148-statement SQL security suite, including per-table privilege checks and all RLS policy categories.
- Anonymous published-content reads, private-table denial, publication windows, and private calendar exclusions.
- Active/inactive accounts, owner/administrator MFA claims, explicit grants, ministry scope, publishing, banner scope, and immediate revocation.
- Role/grant/audit mutation denials, definer search paths/execution privileges, and INSERT/UPDATE/DELETE audit assertions.
- Seed reruns and preservation of a modified weekday/time plus an existing exception.
- First-owner setup with a valid invite and rejection of wrong UUID/email, deleted/uninvited users, an API role, and repeated bootstrap.
- Nine concurrent owner cases: disabling, demoting, or deleting two owners under READ COMMITTED, REPEATABLE READ, and SERIALIZABLE.
- Six concurrent schedule cases: exception-first and series-first changes under the same isolation levels.

The concurrency tests wait for a real PostgreSQL lock or an early serialization rejection, then assert the surviving invariant. They do not rely on a fixed sleep to assume a race occurred.

## Authorization contract

| Account | Content access |
| --- | --- |
| Owner | All six supported permission identifiers, active account and aal2 required |
| Administrator | Only explicit scoped grants, active account and aal2 required |
| Editor | Only explicit scoped grants, active account required |
| Ministry servant | Only explicit scoped grants, active account required |
| Disabled or unassigned user | No administrative content access |
| Anonymous visitor | Only the two published-content RPCs |

The six identifiers are announcements.edit, announcements.publish, events.edit, events.publish, schedules.manage, and audit.read. Unknown or null identifiers fail closed, including for owners. A null grant scope deliberately grants parish-wide authority. A non-null grant matches only that ministry and never a null parish-wide request.

Roles alone grant no rights except owner. Publishing and editing are separate grants. A publisher needs edit permission to read/write the underlying content and publish permission to insert public content, modify already-public content, unpublish it, cancel an event, or archive content. The existing portal uses edit permission for reads as well as writes. Archiving a draft also currently requires publishing permission.

The user's own account role/active flag remains readable before MFA so the login screen can request enrollment. Grant lists and ministry metadata now require active status and, for owners/administrators, aal2. This intentional bootstrap exception exposes only the caller's account row.

## Corrections

1. Explicitly revoke privileges inherited through PUBLIC and direct anon/authenticated defaults on each function and application table. Grant only the intended helper/RPC access back. Revoke audit-sequence access in migration 001, so 001 alone is safe. Remove browser schema CREATE privileges. Supabase defaults may grant EXECUTE directly to API roles, so revoking only PUBLIC was insufficient.
2. Restrict private.allowed to the six declared permission names. It reads the authenticated UUID, current database account, explicit grants, and signed MFA assurance. It never trusts editable user metadata.
3. Replace table-name concatenation in content_guard with explicit announcement/event edit and publish permission mappings. The original plural names already matched the grants; the new mapping makes the contract explicit and rejects unsupported trigger tables.
4. Make content_guard SECURITY INVOKER. Only postgres, supabase_admin, and service_role are trusted maintenance callers. A missing auth.uid() alone no longer skips authorization. Normal API callers require explicit edit permission in addition to RLS.
5. Check the old AND new announcement placement. A ministry publisher cannot remove a parish-wide banner placement to evade parish-wide permission.
6. Preserve immutable record IDs and original creation timestamps and assign update timestamps on the server.
7. Audit INSERT, UPDATE, and DELETE with operation-specific OLD/NEW handling. Capture a small allowlist of before/after security and schedule fields. Cascaded grant deletions are audited too. Trigger-only functions have no API execute grants, and browser roles have no audit mutation privileges.
8. Replace last-owner counting under an advisory lock with a transactional counter and check constraint. It starts at zero only before bootstrap and cannot return to zero afterwards. Concurrent removals serialize or fail serialization under stronger isolation levels.
9. Replace broad schedule FOR ALL policies with separate SELECT/INSERT/UPDATE policies. Browser DELETE remains denied. Schedule management requires an explicit parish-wide schedules.manage grant or MFA-verified ownership.
10. Require valid exception payloads and original recurrence dates. Preserve immutable occurrence identities. Reject series changes that invalidate existing exceptions. Serialize parent/child validation on a private row to avoid concurrent inconsistent changes.
11. Add finite date/time validation, input-size limits, supported calendar date bounds, minute precision for recurring times, and exact-schedule uniqueness. Stable seed IDs keep reruns idempotent, and reruns preserve administrator changes.
12. Reject infinite, oversized, or excessively populated calendar requests. Return public fields only, in deterministic order, and preserve JSON null end times. Public announcement visibility remains status=published AND publication reached AND expiration not reached.
13. Add a guarded first-owner operator script that checks both UUID and email, requires an invited or confirmed Auth record, and refuses reuse. No public bootstrap endpoint exists.

## Public functions

published_announcements() deliberately executes with its owner privileges to read only its fixed projection of eligible announcements. Anonymous users cannot SELECT the underlying table. The result is capped at 100 and deterministically ordered. The caller sees no account, grant, or audit fields.

parish_calendar_data(date,date) exposes only published weekly series, relevant exceptions, and published/cancelled one-time events. Cancellation is an intentional public status protected by events.publish. The function accepts at most 370 days and caps the response at 500 published series, 5,000 relevant exceptions, and 5,000 events. It fails rather than silently truncating an exception. Internal permission/ministry/account information is excluded.

All definer functions use an empty search_path and schema-qualified application objects. Private trigger functions have no PUBLIC, anon, or authenticated execution grants. authenticated can execute private.allowed to support RLS; it returns information about the caller only. Keep the private schema unexposed to the Data API.

## SQL test suite in a staging project

Use a fresh isolated Supabase test project, not parish production data. After approved migrations 001–003 have been applied there, execute supabase/tests/security_review.sql as postgres. It refuses a project that already has an owner. A failed assertion aborts the transaction. End or roll back any failed transaction. Successful completion rolls back all test data and functions.

The suite covers actual object grants, RLS, anonymous reads/writes, publication windows, owner/admin MFA, unknown permission names, explicit grants, scope isolation, unauthorized publishing and unpublishing, event cancellation, role escalation, immediate grant revocation, disabled accounts, missing JWTs, all three audit operations, last-owner protection, recurrence duplication/validation, and Central Time across DST. These checks passed locally and should be repeated in the configured staging project.

Run the seed twice in the isolated project and verify the count remains five. Edit a seeded service title/time, rerun the seed, and verify the edit remains. Also test a changed weekday with a valid exception followed by a seed rerun. The seed must not overwrite the series or reject a harmless conflict.

## Concurrent transaction tests

After establishing two test owners in an isolated database, use two independent trusted PostgreSQL sessions. Start both transactions and read the owners in each. Demote owner A in session A and owner B in session B. Commit A while B waits, then finish B. One operation must fail with the owner constraint or a serialization failure, leaving one active owner. Repeat with REPEATABLE READ and SERIALIZABLE isolation. Repeat with concurrent deletes/disabling. Roll back or restore test fixtures afterward.

For schedules, concurrently insert an exception and change that series to a weekday/date range that invalidates it. One transaction must fail validation or serialization. Verify no invalid exception remains. Deadlock or serialization errors require retrying the whole administrative operation after reloading current data.

## Real-token API tests

SQL role simulation does not verify Auth token issuance or email/MFA flows. Use real invited accounts in the test project, keeping access tokens in the testing client's session.

- With only a publishable key, both RPCs should return allowed public data, while table reads/writes fail.
- With an authenticated editor token, save a draft successfully, then attempt to publish it and modify a published row directly through REST. Both must fail.
- With a scoped servant token, attempt a different ministry and null ministry scope. Inserts must fail and filtered updates must affect zero rows.
- Give a scoped publisher both edit and publish grants. Publication within that ministry should succeed. Parish banner creation or removal must fail.
- Use an owner/admin aal1 token against administrative content, then repeat with an aal2 token. The latter still requires explicit grants for non-owner administrators.
- Set admin_accounts.active=false and repeat a previously permitted request with the same token. It must fail. Revoke a grant and repeat without refreshing the JWT.
- Attempt direct role/grant/audit/private-table writes and trigger-function RPC calls. They must fail.
- Verify future and expired announcements, private drafts, archived events, and unpublished recurring series stay out of public results.

## Ownership and operational boundaries

Use supabase/setup/first_owner.sql as a trusted operator after verifying the intended invited person's identity. It is not part of automatic migration execution. Add and verify a second owner before removing the first. Recovery uses trusted Supabase project administration. Update admin_accounts.active when disabling access so existing JWTs immediately lose application permission.

A trusted database owner or service-role credential can bypass RLS and is outside the browser authorization boundary. Do not expose these credentials. The SQL counter prevents ordinary trusted DML from accidentally removing the last owner, but a database superuser can still disable triggers or truncate tables. Restrict project administrator access.

Future functions/tables must receive their own explicit revocations and policies. These migrations change only their own object ACLs plus browser schema CREATE access; they do not globally rewrite unrelated default privileges. No storage buckets or upload policies are created. The frontend and recurrence engine are unchanged by this SQL review.

The schema still supports weekly recurrence only. Same-day times are serialized to the existing renderer, whose multi-day event and cancellation presentation limitations remain separate frontend work. Schedule changes that invalidate existing exceptions require explicit reconciliation through a trusted operator before changing the series. No implicit reassignment of those exceptions occurs.

## References

- [Supabase database functions and execution grants](https://supabase.com/docs/guides/database/functions)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

