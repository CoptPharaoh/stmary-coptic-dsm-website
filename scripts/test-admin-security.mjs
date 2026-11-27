// Local-only runner: creates its own cluster and never reads website Supabase config.
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const runtimePath = process.argv[2];
if (!runtimePath) throw new Error("Supply a directory containing the isolated embedded-postgres test dependencies.");
const { default: EmbeddedPostgres } = await import(pathToFileURL(resolve(runtimePath, "node_modules/embedded-postgres/dist/index.js")));
const root = fileURLToPath(new URL("../", import.meta.url));
const sql = (file) => readFile(join(root, file), "utf8");
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", resolve);
});
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const directory = await mkdtemp(join(tmpdir(), "stmary-db-test-"));
const postgres = new EmbeddedPostgres({
  databaseDir: join(directory, "data"),
  user: "postgres",
  password: randomBytes(24).toString("hex"),
  port,
  persistent: false,
  createPostgresUser: false,
  postgresFlags: ["-h", "127.0.0.1", "-k", directory],
  onLog() {},
  onError() {},
});
let started = false;
const clients = [];
async function connect() {
  const client = postgres.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  clients.push(client);
  await client.query("set statement_timeout='15s'");
  return client;
}
async function expectFailure(client, statement, codes) {
  try {
    await client.query(statement);
  } catch (error) {
    assert.ok(codes.includes(error.code), error.code + ": " + error.message);
    await client.query("rollback");
    return;
  }
  assert.fail("Expected failure: " + statement);
}

// Confirm an actual lock wait (or early serialization failure), rather than relying on timing.
async function waitForContender(observer, pid, outcome) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (outcome.finished) return;
    const result = await observer.query("select cardinality(pg_blocking_pids($1))>0 as blocked", [pid]);
    if (result.rows[0].blocked) return;
    await delay(25);
  }
  throw new Error("Concurrent transaction did not reach the expected lock.");
}

async function race(observer, first, second, isolation, firstSql, secondSql, permittedErrors) {
  await first.query("begin isolation level " + isolation);
  await second.query("begin isolation level " + isolation);
  // Establish both snapshots before either writes.
  await first.query("select count(*) from public.admin_accounts");
  await second.query("select count(*) from public.admin_accounts");
  await first.query(firstSql);
  const pid = (await second.query("select pg_backend_pid() as pid")).rows[0].pid;
  const outcome = { finished: false };
  const pending = second.query(secondSql).then(
    () => { outcome.finished = true; },
    (error) => { outcome.finished = true; outcome.error = error; },
  );
  await waitForContender(observer, pid, outcome);
  let firstError;
  try { await first.query("commit"); }
  catch (error) { firstError = error; await first.query("rollback"); }
  await pending;
  if (!outcome.error) {
    try { await second.query("commit"); }
    catch (error) { outcome.error = error; }
  }
  await second.query("rollback");
  const failures = [firstError, outcome.error].filter(Boolean);
  assert.ok(failures.length > 0, "Both conflicting changes committed");
  for (const failure of failures) assert.ok(permittedErrors.includes(failure.code), failure.message);
}
try {
  await postgres.initialise();
  await postgres.start();
  started = true;
  const client = await connect();
  console.log((await client.query("select version()")).rows[0].version);
  await client.query(await sql("supabase/tests/local_auth_fixture.sql"));
  for (const file of [
    "202611150001_admin_foundation.sql",
    "202611150002_public_calendar.sql",
    "202611150003_confirmed_schedule.sql",
  ]) {
    await client.query(await sql("supabase/migrations/" + file));
    console.log("PASS migration", file);
  }
  const testResults = await client.query(await sql("supabase/tests/security_review.sql"));
  console.log("PASS SQL security suite", testResults.length, "statements");
  await client.query(await sql("supabase/migrations/202611150003_confirmed_schedule.sql"));
  assert.equal((await client.query("select count(*)::int as count from public.recurring_event_series")).rows[0].count, 5);
  console.log("PASS idempotent seed");

  // Verify seed reruns preserve a modified service and its exception.
  await client.query("update public.recurring_event_series set weekday=1,local_start_time='09:00' where id='sunday-liturgy'");
  await client.query("insert into public.event_exceptions(series_id,original_date,cancelled) values ('sunday-liturgy','2027-03-15',true)");
  await client.query(await sql("supabase/migrations/202611150003_confirmed_schedule.sql"));
  const preserved = (await client.query("select weekday,local_start_time::text from public.recurring_event_series where id='sunday-liturgy'")).rows[0];
  assert.equal(preserved.weekday, 1);
  assert.equal(preserved.local_start_time, "09:00:00");
  await client.query("delete from public.event_exceptions");
  await client.query("update public.recurring_event_series set weekday=0,local_start_time='08:00' where id='sunday-liturgy'");
  console.log("PASS seed preserves changes and exceptions");

  const owner = randomUUID();
  const otherOwner = randomUUID();
  const email = "bootstrap-test@example.invalid";
  await client.query("insert into auth.users(id,email) values ($1,$2),($3,'second-owner@example.invalid')",
    [owner, email, otherOwner]);
  const template = await sql("supabase/setup/first_owner.sql");
  const bootstrap = (id, address) => template.replace("REPLACE-WITH-INVITED-USER-UUID", id)
    .replace("REPLACE-WITH-VERIFIED-OWNER-EMAIL", address);
  await expectFailure(client, bootstrap(owner, email), ["P0001"]); // Not invited or confirmed.
  await client.query("update auth.users set invited_at=now() where id=$1", [owner]);
  await expectFailure(client, bootstrap(randomUUID(), email), ["P0001"]);
  await expectFailure(client, bootstrap(owner, "wrong@example.invalid"), ["P0001"]);
  await client.query("update auth.users set deleted_at=now() where id=$1", [owner]);
  await expectFailure(client, bootstrap(owner, email), ["P0001"]);
  await client.query("update auth.users set deleted_at=null where id=$1", [owner]);
  await client.query("set role authenticated");
  await expectFailure(client, bootstrap(owner, email), ["P0001", "42501"]);
  await client.query("reset role");
  await client.query(bootstrap(owner, email));
  await expectFailure(client, bootstrap(owner, email), ["P0001"]);
  assert.equal((await client.query("select active_count from private.owner_state")).rows[0].active_count, 1);
  console.log("PASS first-owner bootstrap: valid invite, mismatches, deleted/uninvited user, API role, repeat");

  const first = await connect();
  const second = await connect();
  for (const isolation of ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]) {
    for (const operation of ["disable", "demote", "delete"]) {
      await client.query("insert into public.admin_accounts(user_id,role) values ($1,'owner')", [otherOwner]);
      const change = (id) => {
        if (operation === "delete") return "delete from public.admin_accounts where user_id='" + id + "'";
        const assignment = operation === "disable" ? "active=false" : "role='editor'";
        return "update public.admin_accounts set " + assignment + " where user_id='" + id + "'";
      };
      await race(client, first, second, isolation, change(owner), change(otherOwner), ["23514", "40001"]);
      const invariant = (await client.query("select active_count,(select count(*)::int from public.admin_accounts where role='owner' and active) as actual from private.owner_state")).rows[0];
      assert.ok(invariant.actual >= 1);
      assert.equal(invariant.active_count, invariant.actual);
      await client.query("insert into public.admin_accounts(user_id,role,active) values ($1,'owner',true) on conflict(user_id) do update set role='owner',active=true", [owner]);
      await client.query("delete from public.admin_accounts where user_id=$1", [otherOwner]);
      console.log("PASS concurrent owner", operation, isolation);
    }
    for (const exceptionFirst of [true, false]) {
      const insert = "insert into public.event_exceptions(series_id,original_date,cancelled) values ('sunday-liturgy','2027-03-14',true)";
      const update = "update public.recurring_event_series set weekday=1 where id='sunday-liturgy'";
      await race(client, first, second, isolation,
        exceptionFirst ? insert : update, exceptionFirst ? update : insert, ["P0001", "40001"]);
      const invalid = await client.query("select count(*)::int as count from public.event_exceptions e join public.recurring_event_series s on s.id=e.series_id where extract(dow from e.original_date)<>s.weekday");
      assert.equal(invalid.rows[0].count, 0);
      await client.query("delete from public.event_exceptions");
      await client.query("update public.recurring_event_series set weekday=0 where id='sunday-liturgy'");
      console.log("PASS concurrent schedule", exceptionFirst ? "exception first" : "series first", isolation);
    }
  }
  console.log("All local database tests passed.");
} catch (error) {
  console.error("FAIL", error.code || "", error.message || error, error.where || "");
  process.exitCode = 1;
} finally {
  for (const client of clients) await client.end();
  if (started) await postgres.stop();
}

