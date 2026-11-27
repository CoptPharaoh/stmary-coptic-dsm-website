import { getSupabase, withTimeout } from "../supabase-client.js";
import { get, check, message } from "./ui.js";
import { createDashboard } from "./dashboard.js";

// Capture invitation/recovery intent before the SDK consumes the fragment.
const callback = new URLSearchParams(location.hash.slice(1));
let db,
  dashboard,
  factor,
  verifiedUserId,
  generation = 0,
  recovery = false,
  busy = false;
function clearPrivate() {
  generation++;
  dashboard?.dispose();
  dashboard = null;
  factor = null;
  verifiedUserId = null;
  get("workspace").hidden = true;
  get("auth-layout").hidden = false;
  for (const id of ["login", "password-panel", "mfa-panel"])
    get(id).hidden = true;
  get("qr").removeAttribute("src");
  get("qr").hidden = true;
  get("mfa-code").value = "";
  get("password-form").reset();
}
async function run(action) {
  if (busy) return;
  busy = true;
  try {
    await withTimeout(action(), "Authentication request", 30000);
  } catch (error) {
    clearPrivate();
    get("login").hidden = false;
    message(error.message || "Unable to authenticate. Please retry.", true);
  } finally {
    busy = false;
  }
}
async function authorize() {
  clearPrivate();
  const version = generation;
  const current = () => version === generation;
  const { data, error } = await db.auth.getUser();
  if (!current()) return;
  if (error || !data.user) {
    get("login").hidden = false;
    get("logout").hidden = true;
    if (error && error.name !== "AuthSessionMissingError") throw error;
    message("Ready. Sign in with your invited administrator account.");
    return;
  }
  get("logout").hidden = false;
  const account = check(
    await db
      .from("admin_accounts")
      .select("role,active")
      .eq("user_id", data.user.id)
      .maybeSingle(),
  );
  if (!current()) return;
  if (!account?.active)
    throw Error("This account has no active administrative access.");
  const assurance = check(await db.auth.mfa.getAuthenticatorAssuranceLevel());
  if (!current()) return;
  if (
    ["owner", "administrator"].includes(account.role) &&
    assurance.currentLevel !== "aal2"
  ) {
    const factors = check(await db.auth.mfa.listFactors());
    if (!current()) return;
    factor = factors.totp.find((item) => item.status === "verified")?.id;
    if (!factor) {
      // Remove abandoned enrollment factors so a reload cannot exhaust the limit.
      for (const pending of factors.totp.filter(
        (item) => item.status !== "verified",
      )) {
        check(await db.auth.mfa.unenroll({ factorId: pending.id }));
        if (!current()) return;
      }
      const enrollment = check(
        await db.auth.mfa.enroll({ factorType: "totp" }),
      );
      if (!current()) return;
      factor = enrollment.id;
      get("qr").src = enrollment.totp.qr_code;
      get("qr").hidden = false;
    }
    get("mfa-instructions").textContent = get("qr").hidden
      ? "Enter the six-digit code from your authenticator."
      : "Scan this QR code with your authenticator, then enter its six-digit code.";
    get("mfa-panel").hidden = false;
    message("Verify your authenticator to continue.");
    return;
  }
  const grants = check(
    await db
      .from("admin_grants")
      .select("permission,ministry_id")
      .eq("user_id", data.user.id),
  );
  if (!current()) return;
  const ministries = check(
    await db.from("ministries").select("id,name").order("name"),
  );
  if (!current()) return;
  dashboard = createDashboard({
    db,
    account,
    user: data.user,
    grants,
    ministries,
  });
  verifiedUserId = data.user.id;
  get("auth-layout").hidden = true;
  get("workspace").hidden = false;
  await dashboard.start();
}
get("login-form").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    const form = get("login-form");
    const version = generation;
    try {
      check(
        await db.auth.signInWithPassword({
          email: form.elements.email.value,
          password: form.elements.password.value,
        }),
      );
    } finally {
      form.elements.password.value = "";
    }
    if (version !== generation) return;
    recovery = false;
    await authorize();
  });
};
get("reset-request").onclick = () =>
  run(async () => {
    const email = get("login-form").elements.email;
    if (!email.reportValidity()) return;
    check(
      await db.auth.resetPasswordForEmail(email.value, {
        redirectTo: new URL("./index.html", location.href).href,
      }),
    );
    message("Password reset requested. Check your email.");
  });
get("password-form").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    const version = generation;
    check(
      await db.auth.updateUser({
        password: get("password-form").elements.password.value,
      }),
    );
    if (version !== generation) return;
    recovery = false;
    await authorize();
  });
};
get("mfa-form").onsubmit = (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  const version = generation;
  let verified = false;
  // A mistyped code must leave the current enrollment available for retry.
  withTimeout(
    db.auth.mfa.challengeAndVerify({
      factorId: factor,
      code: get("mfa-code").value,
    }),
    "Authenticator verification",
  )
    .then(check)
    .then(() => {
      if (version === generation) {
        verified = true;
        return withTimeout(authorize(), "Account authorization", 30000);
      }
    })
    .catch((error) => {
      if (version === generation || (verified && generation === version + 1)) {
        if (verified) {
          clearPrivate();
          get("login").hidden = false;
        }
        message(error.message, true);
      }
    })
    .finally(() => {
      busy = false;
      get("mfa-code").value = "";
    });
};
get("logout").onclick = async () => {
  clearPrivate();
  recovery = false;
  try {
    check(await withTimeout(db.auth.signOut(), "Sign out"));
    get("logout").hidden = true;
    get("login").hidden = false;
    message("Signed out.");
  } catch (error) {
    message(
      "Private workspace cleared. Sign out failed; retry Sign out before leaving this device. " +
        error.message,
      true,
    );
  }
};
run(async () => {
  db = await getSupabase();
  db.auth.onAuthStateChange((event, session) => {
    if (
      event === "SIGNED_IN" &&
      verifiedUserId &&
      session?.user?.id !== verifiedUserId
    ) {
      clearPrivate();
      message(
        "Account changed. Verifying access; refresh if this message persists.",
      );
      setTimeout(() => run(authorize), 0);
    }
    if (event === "SIGNED_OUT") {
      clearPrivate();
      get("login").hidden = false;
      get("logout").hidden = true;
      message("Signed out.");
    }
    if (event === "PASSWORD_RECOVERY") {
      recovery = true;
      clearPrivate();
      get("password-panel").hidden = false;
      message("Set a password for your account.");
    }
    // Never await SDK requests inside the auth callback (it holds the auth lock).
    if (event === "TOKEN_REFRESHED" && !recovery && !busy) {
      clearPrivate();
      setTimeout(() => run(authorize), 0);
    }
  });
  if (callback.has("error") || callback.has("error_description"))
    throw Error(
      "The authentication link is invalid or expired. Request a new invitation or password reset.",
    );
  if (["invite", "recovery"].includes(callback.get("type")) || recovery) {
    const version = generation;
    const { data, error } = await db.auth.getUser();
    if (version !== generation) return;
    if (error || !data.user)
      throw Error(
        "The authentication link could not be verified. Request a new invitation or password reset.",
      );
    recovery = true;
    clearPrivate();
    get("password-panel").hidden = false;
    get("logout").hidden = false;
    message("Set a password for your account.");
    return;
  }
  await authorize();
});
