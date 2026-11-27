# Administration dashboard implementation and validation

Date: November 27, 2026. Branch: `clean-rebuild`.

## Scope and completed work

The interrupted implementation had saved the responsive dashboard HTML/CSS, local icons, and UI/time helpers. The previous portal and schedules controllers still targeted the old form interface. That work was preserved and connected to the existing Supabase schema without changing public pages, Supabase configuration, or migrations.

- Responsive navy sidebar/header, cream workspace, church identity, functional mobile menu, and authorized navigation.
- Overview metrics queried under existing RLS; upcoming public services and permission-gated audit summaries.
- Announcement and event lists with server-side search, filters, stable pagination, status badges, and date metadata.
- Draft, review, scheduled publication, immediate publication, archive/cancel/unpublish confirmations, safe English/Arabic previews, and scoped ministry options.
- Separate weekly series and occurrence forms; confirmation, validation, existing exception editing, and no fabricated end times.
- America/Chicago input conversion independent of device timezone; winter/summer offsets, DST gap/fold rejection, and exact preservation of unchanged stored instants.
- Auth/MFA gating, bounded requests, invalid-code retry, QR cleanup, reauthorization on token refresh or cross-account sign-in, private-state disposal, and stale-response guards after sign-out.
- No new framework, production dependency, database schema, or elevated browser credential.

## Files

Modified:

- `admin/index.html`
- `css/admin.css`
- `js/admin/portal.js`
- `js/admin/schedules.js`
- `docs/ADMIN_USER_GUIDE.md`
- `scripts/test-admin-startup.cjs`
- `scripts/test-live-navigation.mjs` (wait for asynchronous hashchange before asserting child active state; public behavior unchanged)

Added:

- `js/admin/dashboard.js`
- `js/admin/time.js`
- `js/admin/ui.js`
- `admin/icons/LICENSE`
- `admin/icons/calendar-days.svg`
- `admin/icons/clock.svg`
- `admin/icons/layout-dashboard.svg`
- `admin/icons/log-out.svg`
- `admin/icons/megaphone.svg`
- `admin/icons/menu.svg`
- `admin/icons/plus.svg`
- `admin/icons/refresh-cw.svg`
- `admin/icons/x.svg`
- `scripts/fixtures/admin-client.js`
- `scripts/test-admin-dashboard.mjs`
- `scripts/test-admin-live.mjs`
- `scripts/test-admin-time.mjs`
- `docs/ADMIN_DASHBOARD_VALIDATION.md`

The local icons are Lucide assets with their license. Test fixtures use fictional accounts and are not imported by production code. Screenshots and temporary database/tooling installations stay outside the repository under `/tmp`.

## Tests performed

| Test | Result and boundary |
| --- | --- |
| Existing SQL security runner | PASS on temporary local PostgreSQL 17.7. Migrations 001-003, 148 SQL security statements, seed idempotency/preservation, first-owner bootstrap cases, and 15 concurrency cases across three isolation levels. Not the hosted Supabase instance. |
| Existing startup tests | PASS: anonymous startup, invalid credentials, reset redirect, invitation/recovery fragment handling, expired links, dependency/network errors, owner/administrator MFA gate. Offline auth mocks. |
| Admin time tests | PASS: winter/summer conversions, skipped/repeated hours, optional dates, cancellations/rescheduling, and unknown end times. |
| Dashboard browser tests | PASS: actual local HTML/CSS/modules at 1440, 1024, 768, 390, 320px with isolated Supabase fixtures. Counts, forms, draft/publish/archive, filters/search/pagination, Arabic/XSS-safe preview, event roundtrip, weekly series and occurrence changes, denied-save/empty/error/scoped-role states, MFA retry/success, sign-out and delayed-response cleanup. No horizontal overflow, oversized icons or browser JS errors. |
| Real signed-out browser | PASS at all five widths using the real configured SDK, fresh browser storage, and no mocked authentication. Sign-in loaded, private workspace remained hidden, local assets returned successfully, no JS errors. Hosted mutations were blocked. |
| Existing calendar tests | PASS: recurrence, exceptions, Central Time, ICS exports. |
| Existing public announcement browser tests | PASS: responsive layout, Arabic, XSS safety, loading/success/failure/retry/empty/reload, homepage/interior navigation, public calendar controls. Isolated public-content fixtures. |
| Existing live navigation browser tests | PASS: served bytes across 50 public HTML files, desktop/mobile Parish Life links and active states, nested paths, real anonymous public content. Initial test raced hashchange; test synchronization corrected, not public code. |
| Public asset version check | PASS; no public file updates needed. |
| Syntax/whitespace/local asset checks | PASS. |

Browser screenshots were visually inspected for desktop, tablet, and mobile. The authenticated screenshots contain only fixture data, not a real account or parish records. Real authenticated hosted operations, real email delivery, and a person's TOTP verification have **not** been retested by the agent.

Additional browser checks passed for cross-account sign-in and token refresh: private content is cleared before the new session is authorized. The final test runs have no outstanding failures.

## Reproduce locally

Preview: `http://127.0.0.1:4176/admin/index.html`

Public reference pages: `http://127.0.0.1:4176/index.html`, `http://127.0.0.1:4176/announcements.html`, `http://127.0.0.1:4176/events.html`.

Use the existing server. If it is stopped, run `python3 -m http.server 4176 --bind 127.0.0.1` from the repository root. Do not start a second server on the same port.

```sh
node scripts/test-admin-startup.cjs
node scripts/test-admin-time.mjs
node scripts/test-parish-calendar.cjs
node scripts/version-public-assets.mjs
node scripts/test-admin-security.mjs /tmp/stmary-postgres-review
node scripts/test-admin-dashboard.mjs /path/to/node_modules
node scripts/test-admin-live.mjs /path/to/node_modules
node scripts/test-live-navigation.mjs /path/to/node_modules
TEST_ORIGIN=http://127.0.0.1:4176 node scripts/test-public-announcements.mjs /path/to/node_modules
git diff --check
```

Browser tests require Playwright and installed Chrome. This workstation used `/Users/georgecyrilmikhail/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`. The SQL runner requires its temporary embedded-postgres and pg packages; it creates a disposable loopback database and does not use the hosted project configuration.

Screenshots: `/tmp/stmary-admin-review/overview-1440.png`, `overview-768.png`, `overview-390.png`, `overview-320.png`; also `announcements-*`, `editor-*`, `services-*`, and `live-signin-*` for all five widths.

## Remaining manual acceptance

Follow `ADMIN_USER_GUIDE.md` for sign-in/MFA, scoped account checks, Central Time verification, draft/publishing workflow, recurring exceptions, and sign-out. Real authenticated checks require the account holder. Do not publish or modify existing hosted parish records for tests without explicit approval. Use a disposable local database or specifically approved test records for write tests.

No database changes are required for the implemented dashboard. User/role management, ministry management, book/media management, full activity browsing, and settings remain future work. Exception deletion is not offered because existing grants do not support it. Screenshots use Chromium responsive emulation, not physical iOS/Android devices. The SDK still requires its existing CDN dependency and network access.

No hosted data was modified. No migrations were applied to the hosted project. No commit, push, merge, or deployment was performed.
