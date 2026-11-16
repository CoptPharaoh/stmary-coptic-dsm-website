# Database architecture

admin_accounts references auth.users and stores active status and the owner, administrator, editor, or servant role. admin_grants stores explicit permissions and optional ministry scope. ministries provides stable content categories. Browser users have read access to their own account and grants, with no role-writing privileges.

announcements and events are editable through RLS-scoped access. Publishing is additionally checked by a BEFORE trigger, including changes to previously published content. This prevents an editor from modifying a public record without publishing permission. Ministry reassignment requires trusted administration.

recurring_event_series uses a restricted weekly weekday model and local Central Time, with effective start/end dates. event_exceptions identifies the original series/date and may cancel or replace that occurrence. Their public integration remains pending.

audit_logs receives INSERT/UPDATE metadata from trusted triggers. It records actor, action, entity and identifier, without retaining bodies or secrets. Browser roles cannot insert, alter, or delete these records.

published_announcements is a SECURITY DEFINER RPC with an empty search path, explicit fields, publication/expiration checks, and a 100-record cap. Public roles have no SELECT privilege on the underlying table. Other content is not publicly exposed yet.

Future ministry modules should reference ministries and use the same scoped authorization helper. Media metadata and upload policies are deferred. No child or membership records are collected.

