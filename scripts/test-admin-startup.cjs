// Offline portal tests. No credentials, HTTP requests, or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/admin/portal.js'), 'utf8').replace(/^import .*;\n/, '');
async function scenario({ hash = '', user = null, error = null, libraryError = false, role = 'owner' } = {}) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, textContent: '', replaceChildren() {}, value: '', elements: {}, email: { value: 'test@example.invalid', reportValidity: () => true }, password: { value: 'not-a-real-password' } });
    return nodes.get(id);
  };
  const calls = [];
  let listener;
  const location = { hash, href: 'http://127.0.0.1:4176/admin/index.html', reload() {} };
  const db = { auth: {
    getUser: async () => ({ data: { user }, error }),
    onAuthStateChange: fn => { listener = fn; },
    signInWithPassword: async () => { calls.push('signIn'); return { error: new Error('Invalid login credentials') }; },
    resetPasswordForEmail: async (_, options) => { calls.push(options.redirectTo); return {}; },
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1' } }),
      listFactors: async () => ({ data: { totp: [] } }),
      enroll: async () => { calls.push('enroll'); return { data: { id: 'fixture', totp: { qr_code: 'fixture-only' } } }; }
    }
  }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { active: true, role } }) }) }) }) };
  vm.runInNewContext(source, {
    document: { getElementById: get, querySelectorAll: () => [] }, location, URL, URLSearchParams,
    getSupabase: async () => { location.hash = ''; if (libraryError) throw new Error('Library unavailable'); return db; },
    withTimeout: async operation => operation,
  });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return { get, calls, listener, settle };
}
(async () => {
  let s = await scenario({ error: { name: 'AuthSessionMissingError' } });
  assert.match(s.get('status').textContent, /Ready/);
  assert.equal(s.get('login').hidden, false);
  s.get('login-form').onsubmit({ preventDefault() {}, currentTarget: s.get('login-form') });
  await s.settle();
  assert.match(s.get('status').textContent, /Invalid login/);
  await s.get('reset-request').onclick();
  assert.ok(s.calls.includes('http://127.0.0.1:4176/admin/index.html'));
  for (const type of ['invite', 'recovery']) {
    s = await scenario({ hash: '#type=' + type, user: { id: 'fixture' } });
    assert.equal(s.get('password-panel').hidden, false);
    assert.match(s.get('status').textContent, /Set a password/);
  }
  s = await scenario({ hash: '#type=invite' });
  assert.match(s.get('status').textContent, /could not be verified/);
  s = await scenario({ hash: '#error=access_denied&error_description=expired' });
  assert.match(s.get('status').textContent, /invalid or expired/);
  s = await scenario({ libraryError: true });
  assert.match(s.get('status').textContent, /Library unavailable/);
  s = await scenario({ error: new Error('Network unavailable') });
  assert.match(s.get('status').textContent, /Network unavailable/);
  for (const role of ['owner', 'administrator']) {
    s = await scenario({ user: { id: 'fixture' }, role });
    assert.ok(s.calls.includes('enroll'));
    assert.equal(s.get('workspace').hidden, true);
    assert.equal(s.get('mfa-panel').hidden, false);
  }
  console.log('PASS signed-out startup, sign-in errors, reset redirect, invitation/recovery fragment consumption, invalid links, dependency/network errors, and owner/administrator MFA gating (offline mocks).');
})().catch(error => { console.error(error); process.exitCode = 1; });
