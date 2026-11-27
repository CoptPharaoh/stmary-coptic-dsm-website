# Parish administration dashboard

Open `/admin/index.html` and sign in with your personal invited account. Owners and administrators must verify their TOTP authenticator before private content loads. Public registration is not available. Invitations and password-reset links return to this same page; use **Send password reset** when needed. The first authenticator enrollment shows a QR code; subsequent sign-ins request a code only.

## Your workspace

- **Overview:** authorized published/draft announcement counts, upcoming published events, active weekly series, the next five public services within four weeks, and recent audit activity when permitted.
- **Announcements:** search titles, filter status/ministry/placement, and browse 25 records per page.
- **Events:** manage one-time events, including optional end time and location.
- **Weekly Services:** manage entire weekly series separately from single-date exceptions. This requires parish-wide schedule permission.

Only sections you can use are enabled. An administrator role alone does not grant every permission; existing database grants remain authoritative. Ministry-specific users see only their permitted content. Counts are scoped by your database permissions, not parish-wide totals. Published announcement counts include scheduled or expired records whose **status** is published; the public website applies its publication window separately. Recent activity shows action, entity, and time without exposing full audit payloads.

On a phone or tablet, **Parish menu** opens the sidebar. **View website** opens the public homepage. **Sign out** clears the private workspace immediately. If sign-out fails, retry it before leaving a shared device.

## Announcements and events

1. Choose **Create draft** or an overview quick action.
2. Enter a title and content. Select a permitted ministry when creating the record. Existing ministry assignments cannot be changed in the editor.
3. Announcements support summary, placement, publication, expiration, and optional Arabic title/content. Arabic fields and previews are right-to-left.
4. **Save draft** does not publish. Choose pending review to request review. Authorized publishers can choose published status and a future publication time, then save to schedule publication.
5. **Publish now** changes the status to published and sets an announcement's publication timestamp to now. Confirmation is required. For events it publishes the event while preserving the scheduled start time.
6. **Preview** renders content as safe text, not executable HTML. It is a content preview, not an exact reproduction of every public placement.
7. Changing existing published content, archiving, cancelling, or unpublishing requires publishing permission and confirmation. Editors without that permission can inspect/preview published records but cannot save changes to them.

Homepage and site-banner placement requires parish-wide announcement publishing permission, even for drafts. Ministry placement requires a ministry assignment. Public visibility still depends on status, placement, publication/expiration windows, and the existing authorized public RPC functions. No public anonymous table access was added.

All date/time inputs and displayed dates use **America/Chicago**, regardless of the device's timezone. Summer and winter offsets are converted automatically. New times in the skipped/repeated daylight-saving hour are rejected to avoid silently choosing the wrong instant. An unchanged existing timestamp is preserved exactly, including a repeated-hour timestamp. End/expiration times must follow start/publication times. Blank optional end times stay blank.

Unsaved changes prompt before leaving a view or closing an editor. Saves do not retry automatically. If a save times out, refresh and inspect the record before submitting again; the server may have completed the request.

## Weekly services

The list is loaded from the database, not hardcoded. The confirmed services are Sunday Divine Liturgy (8:00-11:30 AM), Wednesday Divine Liturgy (8:00-10:00 AM), and Saturday Deacons School (6:00 PM), Vespers (7:00 PM), and Midnight Praises (8:00 PM). No end times are invented for the Saturday services.

- **Edit series** changes the title, weekday, times, effective dates, or status of the entire series. A confirmation is required. Database validation prevents invalidating existing exceptions.
- **Change one date** cancels or reschedules one original occurrence. Choose a date on the series' weekday within its effective date range, enter a reason, and confirm. Rescheduling requires a replacement date and start time; the end time is optional.
- Existing exceptions can be reopened. Saving the same series/date replaces that exception, rather than creating duplicates. The latest 100 exceptions are listed; older ones can be updated by entering their original date. Deleting exceptions is not supported by the existing grants and is not offered.

## Access and limitations

Use Refresh to retry a failed view. Permission-denied and unavailable data are distinguished from empty results. Authentication/token renewal rechecks access and clears private state; unsaved content is not retained across reauthentication or sign-out. There is no offline storage of private dashboard data.

Invitations, role/grant changes, ownership recovery, and access revocation remain trusted setup operations described in `ADMIN_SETUP.md`. Ministries, books, media uploads, user management, standalone audit browsing, and settings are intentionally not enabled in this phase. No database migration is required for this dashboard.

## Manual acceptance check

At `http://127.0.0.1:4176/admin/index.html`:

1. Sign in with an existing invited account. Verify that owner/administrator content stays hidden until a valid authenticator code is entered; a wrong code should allow retry.
2. Confirm overview counts against the data your account is permitted to read. Open each enabled section; compare the five weekly services without changing them.
3. Test the mobile Parish menu, search, filters, previews, and Arabic direction. Check a second limited ministry account if available; it must not expose other ministries or parish-wide controls.
4. Without saving, inspect a summer and winter event: parish time must remain Central even when the device uses another timezone.
5. In a disposable local test database, or only with explicit approval for hosted test records, test draft save, scheduled publication, Publish now, archive/unpublish, single-date cancellation/rescheduling, and public reload visibility. Do not alter existing parish records just to test the interface.
6. Verify an invitation/password recovery link using an approved test account. Real email delivery, credentials, authenticator enrollment, and hosted authenticated saves require the account holder; automated verification used fixtures for these writes.
7. Sign out; use Back and Refresh to verify that private data does not reappear. Check another open tab after sign-out as well.

The local server is the existing static server on port 4176. If stopped, run `python3 -m http.server 4176 --bind 127.0.0.1` from the repository root. Use the existing server if the port is occupied.
