# Security status

This implementation is awaiting database execution and adversarial policy tests. It is not production-ready.

## Controls in the implementation

- Default-deny RLS on every application table.
- Active-account checks and database-stored grants.
- MFA assurance level 2 required for owner and administrator content access.
- Explicit publishing checks, including edits to already published records.
- No browser writes to accounts or grants.
- Restricted security-definer search paths and execution grants.
- Public announcement RPC limits columns, time window, and record count.
- Plain text rendering through textContent. Rich HTML is not accepted.
- Database-triggered audit records.
- Last-active-owner protection through a serialized trigger.
- No storage buckets or public upload permissions.

## Tests required before production

Test anonymous table reads/writes, unaffiliated users, disabled accounts, cross-ministry edits, parish-wide placement escalation, role/grant self-promotion, unauthorized publishing, and editing existing published content. Test stale sessions after disabling accounts and removing grants. Test MFA at both aal1 and aal2 using direct REST requests. Test concurrent owner changes and failed transactions.

Test future publication and expiration against database time. Confirm no internal records leak through public RPCs. Check authentication redirects, invitation expiry, reset replay, and session restoration. Review and test SMTP rate limits and Auth abuse protections.

No PostgreSQL server or Supabase project was available during initial implementation. These tests have not been run. Static JavaScript and local page checks do not establish database security.

## Remaining work

Portal invitations require a server-side function with independent caller/grant checks and audit records. Until implemented, use trusted Supabase administration. Storage requires separate public/private buckets, validated file types, limits, rights metadata, and scoped policies. Calendar RPCs need bounded dates, exception correctness, and timezone tests before integration.

Do not enable production writes from deploy previews. Use separate projects. Keep service-role keys exclusively in trusted server environments. Review headers against existing media embeds before changing CSP. Backups and operational recovery must be rehearsed for the actual Supabase plan.

Official references:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/auth-mfa
- https://supabase.com/docs/guides/auth/users

